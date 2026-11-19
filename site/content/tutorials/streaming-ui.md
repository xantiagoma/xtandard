---
title: "Streaming results into the UI"
description: "Produce results with an async generator or an AsyncChannel, render them as they arrive with useStream and StreamRenderer, and track them in a toast with toastStream."
---

Some work produces results one at a time: asking several suppliers for a price, importing rows,
running steps of a job. Waiting for the whole batch makes the UI feel slow. In this tutorial you build
a price check that shows each supplier's quote as soon as it arrives, in a list and in a toast, using
three pieces:

- a **producer**: an async generator, or an [`AsyncChannel`](@BASE@/api/core/classes/asyncchannel/)
  when results arrive from several concurrent requests;
- [`useStream`](@BASE@/api/react/functions/usestream/) and
  [`StreamRenderer`](@BASE@/api/react/functions/streamrenderer/) from `@xtandard/lib/react`, which
  render a stream with TanStack Query;
- [`toastStream`](@BASE@/api/sonner/functions/toaststream/) from `@xtandard/lib/sonner`, which keeps a
  Sonner toast updated while the stream runs.

```sh
npm install @xtandard/lib react @tanstack/react-query sonner
```

## 1. Set up the providers

`useStream` runs the stream inside a TanStack Query query, so it needs a `QueryClientProvider`.
`toastStream` drives Sonner's `toast`, so render a `<Toaster />` once.

```tsx title="src/App.tsx"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { PriceCheck } from "./PriceCheck";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PriceCheck sku="BOARD-GAME-42" />
      <Toaster />
    </QueryClientProvider>
  );
}
```

## 2. Produce results with an async generator

Start with the simplest producer: an async generator that asks one supplier at a time and `yield`s
each quote. When it finishes, it `return`s a summary. Both `useStream` and `toastStream` capture that
return value, so the UI can show "3 of 4 suppliers answered" at the end.

```ts title="src/quotes.ts"
import { AsyncChannel, wait } from "@xtandard/lib";

export type Quote = { supplier: string; priceCents: number };
export type QuoteSummary = { asked: number; answered: number; failed: string[] };

const SUPPLIERS = ["acme", "globex", "initech", "umbrella"];

// Stand-in for a real HTTP call: each supplier answers after a random delay, and one is down.
export async function fetchQuote(supplier: string, sku: string): Promise<Quote> {
  await wait(50 + Math.random() * 100);
  if (supplier === "umbrella") throw new Error(`${supplier} is down`);
  return { supplier, priceCents: 1000 + ((supplier.length * 37 + sku.length * 11) % 900) };
}

// Pull-based: one supplier at a time, in a fixed order.
export async function* quotesInOrder(sku: string): AsyncGenerator<Quote, QuoteSummary> {
  const failed: string[] = [];
  let answered = 0;
  for (const supplier of SUPPLIERS) {
    try {
      yield await fetchQuote(supplier, sku);
      answered++;
    } catch {
      failed.push(supplier);
    }
  }
  return { asked: SUPPLIERS.length, answered, failed };
}
```

A generator is **pull-based**: it does not ask the next supplier until the consumer asks for the next
value. That is simple and gives you backpressure, but the suppliers are asked one after another, so the
total time is the sum of all their delays.

## 3. Push results as they arrive with `AsyncChannel`

To ask every supplier at once and show each answer the moment it lands, you need a **push-based**
source. An `AsyncChannel` is an async iterable that you feed from outside: `push(value)` emits an item,
`resolve(returnValue)` finishes the stream with a return value, and `reject(error)` fails it.

```ts title="src/quotes.ts"
// Push-based: ask everyone at once, emit quotes in arrival order.
export function quotesAsTheyArrive(sku: string): AsyncChannel<Quote, QuoteSummary> {
  const channel = AsyncChannel.create<Quote, QuoteSummary>();
  const failed: string[] = [];
  let answered = 0;

  const requests = SUPPLIERS.map(async (supplier) => {
    try {
      channel.push(await fetchQuote(supplier, sku));
      answered++;
    } catch {
      failed.push(supplier);
    }
  });

  void Promise.all(requests).then(() => {
    if (answered === 0) channel.reject(new Error("No supplier answered"));
    else channel.resolve({ asked: SUPPLIERS.length, answered, failed });
  });

  return channel;
}
```

A few rules keep a channel well-behaved:

- **Create one channel per run.** `AsyncChannel.create()` is in _consume_ mode: values go to the first
  consumer, and the channel cannot be restarted. Returning a fresh channel from a function gives every
  run, and every retry, its own.
- **Close it exactly once**, with `resolve` or `reject`. A consumer waits until the channel closes, so
  a producer that never closes it leaves the UI "streaming" forever. Calling `push` after it is closed
  throws `Cannot push to a closed channel`, so if you add a timeout, stop pushing when it fires.
- For several consumers of the **same** run (a list and a counter, say), use
  `AsyncChannel.broadcast()` or `broadcastReplay()`. See [Async](@BASE@/core/async/) for all four
  modes.

## 4. Render the stream with `useStream`

`useStream` consumes a source and re-renders as items arrive. Pass a **factory** (a function that
creates the source), not a source you already created, and give it a `queryKey`:

```tsx title="src/QuoteList.tsx"
import { useStream } from "@xtandard/lib/react";
import { type Quote, type QuoteSummary, quotesAsTheyArrive } from "./quotes";

const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function QuoteList({ sku }: { sku: string }) {
  const { items, count, isLoading, isStreaming, isSuccess, isError, returnValue, refetch, query } =
    useStream<Quote, QuoteSummary>({
      source: () => quotesAsTheyArrive(sku),
      queryKey: ["quotes", sku],
    });

  if (isLoading) return <p>Asking suppliers…</p>;
  if (isError) return <p role="alert">{query.error?.message}</p>;

  return (
    <section>
      <ul>
        {items.map((q) => (
          <li key={q.supplier}>
            {q.supplier}: {price(q.priceCents)}
          </li>
        ))}
      </ul>
      {isStreaming && <p>{count} answered so far…</p>}
      {isSuccess && returnValue && (
        <p>
          {returnValue.answered} of {returnValue.asked} answered
          {returnValue.failed.length > 0 && ` (no answer: ${returnValue.failed.join(", ")})`}
          <button onClick={() => refetch()}>Ask again</button>
        </p>
      )}
    </section>
  );
}
```

The status flags follow the stream:

| Flag          | True when                                                  |
| ------------- | ---------------------------------------------------------- |
| `isLoading`   | the stream has started but no item has arrived yet         |
| `isStreaming` | at least one item has arrived and the stream is still open |
| `isSuccess`   | the source finished; `returnValue` holds what it returned  |
| `isError`     | the source threw or the channel was rejected               |

`refetch()` restarts the stream. It calls the factory again, which is why you pass a factory: a
generator or channel instance can only be iterated once, so a refetch would find it already finished.

:::caution[Always pass a `queryKey`, and the type arguments]
Without `queryKey`, the key defaults to `["stream", source]`. TanStack Query hashes keys as JSON, and a
function becomes `null`, so every `useStream` without a key shares the cache entry `["stream",null]`.
Put whatever the stream depends on (here `sku`) in the key; changing it starts a new stream.

The hook cannot infer the return type from the source, so `returnValue` is typed `void` unless you write
`useStream<Quote, QuoteSummary>(…)`.
:::

## 5. Keep only what you need

By default `useStream` keeps every item. For long or endless streams, keep less:

- `mode: "latest"` keeps only the most recent item;
- `maxItems: 100` keeps a sliding window of the last 100;
- `reducer` plus `initialState` folds items into your own state, returned as `state`.

A reducer that tracks the cheapest quote so far:

```tsx title="src/BestQuote.tsx"
import { useStream } from "@xtandard/lib/react";
import { type Quote, quotesAsTheyArrive } from "./quotes";

export function BestQuote({ sku }: { sku: string }) {
  const { state: best, isSuccess } = useStream({
    source: () => quotesAsTheyArrive(sku),
    queryKey: ["best-quote", sku],
    reducer: (best: Quote | null, quote: Quote) =>
      best === null || quote.priceCents < best.priceCents ? quote : best,
    initialState: null,
  });

  if (!best) return <p>Waiting for the first quote…</p>;
  return (
    <p>
      {isSuccess ? "Best price" : "Best so far"}: {best.supplier} at $
      {(best.priceCents / 100).toFixed(2)}
    </p>
  );
}
```

`count` still reports how many items arrived, even when you keep fewer of them.

## 6. Or render it declaratively with `StreamRenderer`

`StreamRenderer` wraps `useStream` in a component with one prop per state. Each prop is either a node
or a function of that state's data. Here it consumes the in-order generator from step 2:

```tsx title="src/QuoteProgress.tsx"
import { StreamRenderer } from "@xtandard/lib/react";
import { type Quote, type QuoteSummary, quotesInOrder } from "./quotes";

export function QuoteProgress({ sku }: { sku: string }) {
  return (
    <StreamRenderer<Quote, QuoteSummary>
      source={() => quotesInOrder(sku)}
      queryKey={["quotes-in-order", sku]}
      loading={<p>Asking suppliers…</p>}
      streaming={({ count, latest }) => (
        <p>
          {count} so far, latest from {latest.supplier}
        </p>
      )}
      success={({ items, returnValue }) => (
        <p>
          Done: {items.length} quotes, {returnValue?.failed.length ?? 0} failed
        </p>
      )}
      error={({ error, count }) => (
        <p role="alert">
          Stopped after {count}: {error.message}
        </p>
      )}
    />
  );
}
```

Leave out a prop and the `children` render prop is used instead; it receives a `status` field
(`"loading"`, `"streaming"`, `"success"` or `"error"`) with the matching data. `StreamRenderer` also
takes `mode` and `maxItems`. For a reducer, or to start the stream only on demand with `enabled`, use
the `useStream` hook.

## 7. Track the stream in a toast

`toastStream` is like Sonner's `toast.promise`, but for a stream: it shows `loading`, updates the same
toast with `streaming` on every item, and ends with `success` or `error`. It resolves to
`{ items, returnValue }` when the stream completes.

```tsx title="src/RefreshButton.tsx"
import { tryCatch } from "@xtandard/lib";
import { toastStream } from "@xtandard/lib/sonner";
import { quotesAsTheyArrive } from "./quotes";

export function RefreshButton({
  sku,
  onDone,
}: {
  sku: string;
  onDone: (cheapest: number) => void;
}) {
  async function refresh() {
    const [result, error] = await tryCatch(
      toastStream(() => quotesAsTheyArrive(sku), {
        loading: "Asking suppliers…",
        streaming: ({ count, latest }) => `${count} answered, latest: ${latest.supplier}`,
        success: ({ returnValue }) =>
          `${returnValue.answered} of ${returnValue.asked} suppliers answered`,
        error: (err, { count }) => `Stopped after ${count} quotes: ${String(err)}`,
      }),
    );
    if (error) return; // the error toast is already showing
    onDone(Math.min(...result.items.map((q) => q.priceCents)));
  }

  return <button onClick={refresh}>Refresh prices</button>;
}
```

Unlike `useStream`, `toastStream` infers `returnValue`'s type from the generator or channel, so no type
arguments are needed. On failure it shows the `error` toast and then **rethrows**, which is why the
call is wrapped in [`tryCatch`](@BASE@/core/error-handling/). The `error` callback also receives the
items that arrived before the failure.

When the caller should not wait, use
[`toastStreamAsync`](@BASE@/api/sonner/functions/toaststreamasync/). It returns the toast id at once,
with an `unwrap()` method for the result:

```ts
import { toastStreamAsync } from "@xtandard/lib/sonner";

const toastId = toastStreamAsync(() => quotesAsTheyArrive(sku), {
  loading: "Refreshing prices…",
  success: ({ count }) => `${count} prices updated`,
});

// later, only if the result matters:
const { items, returnValue } = await toastId.unwrap();
```

## 8. Fake the producer while you build the UI

You do not need the real backend to build these components. Any iterable is a valid source, so
[`asyncOf`](@BASE@/core/async/) turns fixed values into an async stream, and the `delay` option
spaces them out so you can watch each state:

```tsx
import { asyncOf } from "@xtandard/lib";
import { StreamRenderer } from "@xtandard/lib/react";

const fixtures = [
  { supplier: "acme", priceCents: 1203 },
  { supplier: "globex", priceCents: 1277 },
  { supplier: "initech", priceCents: 1314 },
];

<StreamRenderer
  source={() => asyncOf(...fixtures)}
  queryKey={["quotes-preview"]}
  delay={{ first: 500, items: 300 }}
  streaming={({ count }) => <p>{count} so far…</p>}
  success={({ items }) => <p>{items.length} quotes</p>}
/>;
```

`delay` takes a number (the same pause before the first item, between items and before the result) or
`{ first, items, result }`. `toastStream` accepts the same option.

In unit tests, test the producer without React. `collect` from `@xtandard/lib` drains an async
iterable into an array:

```ts
import { collect } from "@xtandard/lib";
import { expect, test } from "vitest";
import { quotesInOrder } from "./quotes";

test("skips suppliers that fail", async () => {
  const quotes = await collect(quotesInOrder("BOARD-GAME-42"));
  expect(quotes.map((q) => q.supplier)).toEqual(["acme", "globex", "initech"]);
});
```

`asyncOf` sources have no return value, so `returnValue` is `undefined` when you use them.

## The complete result

`src/quotes.ts` (steps 2 and 3) is the only producer code. The components use it like this:

```tsx title="src/PriceCheck.tsx"
import { useState } from "react";
import { BestQuote } from "./BestQuote";
import { QuoteList } from "./QuoteList";
import { RefreshButton } from "./RefreshButton";

export function PriceCheck({ sku }: { sku: string }) {
  const [cheapest, setCheapest] = useState<number | null>(null);

  return (
    <main>
      <h1>Prices for {sku}</h1>
      <BestQuote sku={sku} />
      <QuoteList sku={sku} />
      <RefreshButton sku={sku} onDone={setCheapest} />
      {cheapest !== null && <p>Last refresh: cheapest ${(cheapest / 100).toFixed(2)}</p>}
    </main>
  );
}
```

On screen, `QuoteList` shows "Asking suppliers…", then fills in acme, globex and initech in the order
they answer, and finally "3 of 4 answered (no answer: umbrella)". At the same time `BestQuote` moves
from "Best so far" to "Best price". `BestQuote` and `QuoteList` each start their own run of
`quotesAsTheyArrive`, because each calls the factory. To share one run between them, lift it into one
`useStream` and pass the result down, or use a broadcast channel.

## Where next

- [Async](@BASE@/core/async/): `AsyncChannel`'s four modes, `Completer`, and `wait`.
- [Iterables & generators](@BASE@/core/iterables/): `collect`, `enumerate` and the type guards that
  tell sources apart.
- [React](@BASE@/integrations/react/): every `useStream` option, including `retry` and `onItem`.
- [Sonner](@BASE@/integrations/sonner/): all `toastStream` messages and options.
- [A filterable, paginated list](@BASE@/tutorials/filterable-list/): the other half of a data-heavy UI.
