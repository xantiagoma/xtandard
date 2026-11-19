---
title: "React"
description: "React helpers: useStream and StreamRenderer for rendering generators and async iterables, Providers for flat provider trees, plus focus and dynamic-ref hooks."
---

`@xtandard/lib/react` has two kinds of helpers. `useStream` and `StreamRenderer` render a **stream** (a generator, async iterable, array or `AsyncChannel`) as it produces values, on top of TanStack Query. `Providers`, `usePreventAutoFocus` and `useDynamicRefs` are small, dependency-free hooks and components for everyday React code.

```sh
npm install @xtandard/lib react @tanstack/react-query
```

```ts
import {
  useStream,
  StreamRenderer,
  Providers,
  provider,
  usePreventAutoFocus,
  useDynamicRefs,
} from "@xtandard/lib/react";
```

Both `react` (18 or 19) and `@tanstack/react-query` (v5) are optional peer dependencies. Install both whenever you import from this entry, because it imports both when it loads.

## `useStream`

`useStream` consumes a stream source and re-renders as items arrive. Internally it is a `useQuery` with TanStack Query's `streamedQuery`, so the stream is cached, deduplicated and refetchable like any other query. The component must be inside a `QueryClientProvider`.

A **source** is any iterable, async iterable, iterator, generator or `AsyncChannel`, or a function that returns one (the same `StreamSource` type used by the [core async helpers](@BASE@/core/async/)). Pass a factory such as `progress` (not `progress()`) so the stream can be re-created on `refetch()`; a generator object can only be consumed once.

```tsx
import { useStream } from "@xtandard/lib/react";

type Step = { step: number };

async function* importRows() {
  for (let i = 1; i <= 3; i++) {
    await saveRow(i);
    yield { step: i };
  }
  return "done";
}

function ImportProgress() {
  const { items, count, latest, returnValue, isLoading, isStreaming, isSuccess, isError, refetch } =
    useStream({ source: importRows, queryKey: ["import"] });

  if (isLoading) return <p>Starting…</p>;
  if (isStreaming)
    return (
      <p>
        Step {latest?.step} ({count} so far)
      </p>
    );
  if (isSuccess)
    return (
      <p>
        Finished {items.length} steps: {returnValue}
      </p>
    );
  if (isError) return <button onClick={() => refetch()}>Retry</button>;
  return null;
}
```

The result holds `items`, `count` (all items received, even when not all are kept), `latest`, `returnValue` (the generator's `return` value, once complete), `refetch`, the underlying `query`, and four flags:

| Flag          | True when                                                      |
| ------------- | -------------------------------------------------------------- |
| `isLoading`   | Fetching and no item has arrived yet.                          |
| `isStreaming` | At least one item has arrived and the stream is still running. |
| `isSuccess`   | The stream finished.                                           |
| `isError`     | The stream threw.                                              |

Both types are inferred from `source`: the item type, and the return type of a generator or `AsyncChannel` (here `string`), so `returnValue` is typed without type arguments. Sources without a return value (arrays, plain iterables) type it `void | undefined`.

`queryKey` is the TanStack Query cache key: put whatever the stream depends on in it. A new key starts a new stream, and hooks with the same key share one. Without a `queryKey`, the stream belongs to that one hook instance: it is stable across renders, never shared with another component, and it does not restart when `source` changes (a new inline factory every render is fine). Pass a key when you want a stream to restart on new inputs, or to be shared.

### Keeping fewer items

By default every item is kept in `items`. For long or endless streams, pick one of the mutually exclusive modes (TypeScript enforces that you set at most one):

```tsx
// Only the most recent item
const { latest } = useStream({ source: priceTicks, queryKey: ["ticks"], mode: "latest" });

// Sliding window of the last N items (count still counts every item)
const { items, count } = useStream({ source: logLines, queryKey: ["logs"], maxItems: 100 });

// Your own reducer; the result has `state` instead of `items`
const { state: total } = useStream({
  source: [3, 4, 5],
  queryKey: ["sum"],
  reducer: (sum: number, n: number) => sum + n,
  initialState: 0,
}); // total === 12 once complete
```

### Other options

| Option                  | Description                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`               | Default `true`. The query is also disabled while `source` is `null` or `undefined`.                                                                                                          |
| `retry`                 | Default `false`. `true` (TanStack's default of 3), a number, or `(data) => boolean` where `data` has `failureCount`, `error`, and the `items`/`count`/`latest` collected before the failure. |
| `onItem`                | Called with `{ item, count, items }` for each item.                                                                                                                                          |
| `onSuccess` / `onError` | Called once when the stream completes (`{ count, items, returnValue }`) or fails (`{ error, count, items }`).                                                                                |
| `delay`                 | Artificial delay in ms, a number or `{ first, items, result }`. Useful for demoing sync sources, which otherwise finish instantly.                                                           |

The query uses `staleTime: Infinity` and disables refetch-on-focus, so a completed stream is not re-run unless you call `refetch()` or change the key. A refetch resets the accumulated items.

## `StreamRenderer`

The component form of `useStream`. Pass render props for each state: each is either a node or a function of the state's data. `children` is the fallback for any state you did not cover, and receives a discriminated union on `status` (`"loading" | "streaming" | "success" | "error"`).

```tsx
import { StreamRenderer } from "@xtandard/lib/react";

<StreamRenderer
  source={importRows}
  queryKey={["import"]}
  loading={<Spinner />}
  streaming={({ count, latest }) => (
    <p>
      Step {latest.step} ({count} so far)
    </p>
  )}
  success={({ items, returnValue }) => (
    <p>
      {items.length} steps, {returnValue}
    </p>
  )}
  error={({ error, count }) => (
    <p>
      Failed after {count} steps: {error.message}
    </p>
  )}
/>;

// Or one render function for every state
<StreamRenderer source={importRows} queryKey={["import"]}>
  {(s) => (s.status === "error" ? <p>{s.error.message}</p> : <p>{s.count} steps</p>)}
</StreamRenderer>;
```

It accepts `mode`, `maxItems`, `delay`, `enabled`, `retry`, `onItem`, `onSuccess` and `onError` like the hook. It has no `reducer` mode; use `useStream` for that.

## `Providers` and `provider`

Composes a list of context providers without nesting JSX ("provider hell"). The list is ordered outer to inner. Build each entry with `provider(Component, props)`: it infers the provider's props, requires the props argument when the provider has required props, and makes it optional when it has none.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Providers, provider } from "@xtandard/lib/react";

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Providers
      providers={[
        provider(QueryClientProvider, { client: queryClient }), // outermost
        provider(ThemeProvider, { theme: "dark" }),
        provider(AuthProvider), // no required props: second argument optional
      ]}
    >
      {children}
    </Providers>
  );
}
```

`children` is omitted from the props you pass; `Providers` supplies it. Keep the array stable in order: each provider's React key is its display name plus its index, so reordering remounts the subtree.

## `usePreventAutoFocus`

Dialog libraries such as Radix focus the first focusable element when a dialog opens. That often lands on a text field (and opens the keyboard on mobile) or a close button. This hook stops that and focuses the dialog container instead, so keyboard users still start inside the dialog.

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { usePreventAutoFocus } from "@xtandard/lib/react";

function EditDialog() {
  const preventAutoFocus = usePreventAutoFocus();

  return (
    <Dialog.Content {...preventAutoFocus}>
      <input name="title" />
    </Dialog.Content>
  );
}
```

It returns `{ ref, onOpenAutoFocus, tabIndex: -1 }`. `onOpenAutoFocus` calls `event.preventDefault()` and focuses `ref` with `preventScroll`. `tabIndex={-1}` makes the container programmatically focusable without adding it to the tab order. The element type defaults to `HTMLDivElement`; pass another with `usePreventAutoFocus<HTMLFormElement>()`.

## `useDynamicRefs`

Returns a getter that creates (or reuses) a `RefObject` per string key. Use it when the number of refs is only known at runtime: list items, tabs, sections to scroll to.

```tsx
import { useDynamicRefs } from "@xtandard/lib/react";

function Sections({ ids }: { ids: string[] }) {
  const getRef = useDynamicRefs<HTMLElement>();

  const scrollTo = (id: string) => getRef(id).current?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <nav>
        {ids.map((id) => (
          <button key={id} onClick={() => scrollTo(id)}>
            {id}
          </button>
        ))}
      </nav>
      {ids.map((id) => (
        <section key={id} ref={getRef(id)}>
          {id}
        </section>
      ))}
    </>
  );
}
```

`getRef(key)` returns the same ref object for the same key across renders. Calling it without a key (or with `""`) returns `undefined`. The `prefix` option namespaces the map: changing `prefix` throws away all refs and starts a new map. Refs for keys that disappear are not removed; that is fine for lists of bounded size.

## See also

- API reference: [`useStream`](@BASE@/api/react/functions/usestream/), [`StreamRenderer`](@BASE@/api/react/functions/streamrenderer/), [`Providers`](@BASE@/api/react/functions/providers/), [`provider`](@BASE@/api/react/functions/provider/), [`usePreventAutoFocus`](@BASE@/api/react/functions/usepreventautofocus/), [`useDynamicRefs`](@BASE@/api/react/functions/usedynamicrefs/)
- [Sonner](@BASE@/integrations/sonner/): show the same kind of stream in a toast.
- Source: [`stream-renderer.tsx`](@REPO@/blob/main/src/stream-renderer.tsx)
