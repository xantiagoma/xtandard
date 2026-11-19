---
title: "Misc"
description: "cast, a typed log, time-unit converters, prepareLoaderResult for DataLoader batch functions, and the StreamSource type with resolveStreamSource."
---

Small helpers that don't fit the other core pages: an explicit type cast, a `console.log` that returns its
input, time-unit conversions, a function that lines up database rows with DataLoader keys, and the
`StreamSource` type used by the streaming helpers.

```ts
import {
  cast,
  log,
  secondsToMs,
  minutesToMs,
  hoursToMs,
  prepareLoaderResult,
  resolveStreamSource,
  type StreamSource,
} from "@xtandard/lib";
```

## `cast`

`cast<T>(value)` returns `value` typed as `T`. It does exactly what `value as T` does, with no runtime check,
but as a function call it fits in expression chains and is easy to search for.

```ts
const config = cast<AppConfig>(JSON.parse(raw));
```

:::caution
`cast` is an unchecked assertion. If the data might not match, validate it (with a schema library or a type
guard) instead.
:::

## `log`

`log(...args)` calls `console.log(...args)` and returns its input with the type kept, so you can put it
around an expression without restructuring the code:

```ts
const total = log(price * quantity); // logs 30; total: number
const [a, b] = log(first, second); // logs both; returns the tuple [first, second]
log(); // logs an empty line; returns undefined
```

| Call           | Returns                        |
| -------------- | ------------------------------ |
| `log()`        | `undefined`                    |
| `log(x)`       | `x`, with its type             |
| `log(a, b, …)` | the arguments as a typed tuple |

It is meant for debugging. Remove it before you commit, as you would a `console.log`.

## `secondsToMs`, `minutesToMs`, `hoursToMs`

Convert a duration to milliseconds, for APIs such as `setTimeout`, cache TTLs and cookie `maxAge`:

```ts
secondsToMs(1.5); // 1500
minutesToMs(2); // 120000
hoursToMs(1); // 3600000

setTimeout(refresh, minutesToMs(5));
```

They are plain multiplications with no validation or rounding. For calendar-aware durations, see the
[Temporal integration](@BASE@/integrations/temporal/).

## `prepareLoaderResult`

A [DataLoader](https://github.com/graphql/dataloader) batch function must return one result per key, **in the
same order as the keys**. A database query returns rows in any order and leaves out the ones that don't exist.
`prepareLoaderResult` matches the rows to the keys:

```ts
const keys = [3, 1, 2];
const rows = [
  { id: 1, name: "Ada" },
  { id: 2, name: "Linus" },
];

await prepareLoaderResult({ keys, results: rows });
// [undefined, { id: 1, name: "Ada" }, { id: 2, name: "Linus" }]
```

It always returns a `Promise`, because `mapValue` may be async. It works with any DataLoader setup. With
xtandard's [`createLoader`](@BASE@/integrations/dataloader/), it looks like this:

```ts
const userLoader = createLoader<User | undefined, Ctx>(async ({ keys }) => {
  const rows = await db.users.findMany({ where: { id: { in: [...keys] } } });
  return prepareLoaderResult({ keys, results: rows });
});
```

### Options

| Option             | Default                  | Effect                                                                                             |
| ------------------ | ------------------------ | -------------------------------------------------------------------------------------------------- |
| `keys`             | (required)               | The keys DataLoader passed in, in order.                                                           |
| `results`          | (required)               | The rows your query returned, in any order.                                                        |
| `getKey(row)`      | `row.id`, else `row.uid` | Gets the key of a row. Without it, a row that has neither `id` nor `uid` makes the call **throw**. |
| `mapValue(row)`    | the row itself           | Transforms each row; may be async. Rows are mapped one at a time, in order.                        |
| `mode`             | `"one"`                  | `"many"` groups rows into an array per key (one-to-many).                                          |
| `defaultValue`     | `undefined`              | `"one"` mode only: the value for keys with no matching row.                                        |
| `keyToString(key)` | (none)                   | Turns object keys into strings so they can be matched by value.                                    |

**One-to-many.** With `mode: "many"`, each key gets an array of its rows, and a key with no rows gets `[]`:

```ts
const photos = await db.photos.findMany({ where: { userId: { in: [...keys] } } });

return prepareLoaderResult({
  keys,
  results: photos,
  mode: "many",
  getKey: (photo) => photo.userId,
});
// [Photo[], Photo[], ...]: one array per key
```

**Composite keys.** Rows are matched to keys with a `Map`, so object keys only match if they are the same
object. When keys are objects, pass `keyToString` so they are compared by value:

```ts
return prepareLoaderResult({
  keys, // e.g. [{ orgId: "a", slug: "home" }, ...]
  results: rows,
  getKey: (row) => ({ orgId: row.orgId, slug: row.slug }),
  keyToString: (key) => `${key.orgId}:${key.slug}`,
});
```

**Missing rows.** In the default mode, a key with no row gets `undefined`, or `defaultValue` if you set one
(for example `null` for GraphQL). A key that appears twice gets the same result twice.

## `StreamSource` and `resolveStreamSource`

`StreamSource<T>` is the input type that xtandard's streaming helpers accept, such as
[`StreamRenderer` / `useStream`](@BASE@/integrations/react/) and [`toastStream`](@BASE@/integrations/sonner/).
It is either an **instance** of one of these:

- `Iterable<T>` (an array, a `Set`, …), an `Iterator<T>` or a `Generator`;
- `AsyncIterable<T>`, an `AsyncIterator<T>` or an `AsyncGenerator`,

or a **factory**: a function with no arguments that returns one of them. Pass a factory when the stream
should be created lazily, or created again each time it is consumed. A generator can only be read once, but
a factory makes a new one on each call.

`resolveStreamSource(source)` calls the factory if `source` is a function and otherwise returns the instance
unchanged:

```ts
function* countdown() {
  yield 3;
  yield 2;
  yield 1;
}

resolveStreamSource(countdown); // calls the factory: a new generator
resolveStreamSource(countdown()); // the same generator instance
resolveStreamSource([1, 2, 3]); // the same array
```

Use it when you write your own consumer that accepts a `StreamSource`. Combine it with
[`toAsyncIterable`](@BASE@/core/iterables/#toasynciterable) to handle every case with one `for await` loop:

```ts
import { resolveStreamSource, toAsyncIterable, type StreamSource } from "@xtandard/lib";

async function drain<T>(source: StreamSource<T>, onValue: (value: T) => void) {
  for await (const value of toAsyncIterable(resolveStreamSource(source))) {
    onValue(value);
  }
}

await drain(countdown, console.log); // 3, 2, 1
await drain([1, 2], console.log); // 1, 2
```
