---
title: "Iterables & generators"
description: "Numeric ranges, Python-style enumerate for sync and async iterables, and helpers that turn any iterable or iterator into an Iterator or AsyncIterable."
---

These helpers work with JavaScript's iteration protocols. They generate numeric ranges, attach indexes to
values, and convert between iterables and iterators so one function can accept many kinds of source.

```ts
import {
  range,
  rangeLazy,
  enumerate,
  enumerateAsync,
  toIterator,
  toAsyncIterable,
} from "@xtandard/lib";
```

## `range` and `rangeLazy`

`range` returns an array of numbers, and `rangeLazy` returns a generator that produces them one at a time.
They take the same arguments. The end is **exclusive**.

```ts
range(5); // [0, 1, 2, 3, 4]
range(2, 5); // [2, 3, 4]
range(0, 10, { step: 2 }); // [0, 2, 4, 6, 8]
range(0, 5, { direction: "desc" }); // [4, 3, 2, 1, 0]

[...rangeLazy(3)]; // [0, 1, 2]
```

The optional config is `{ step?: number; direction?: "asc" | "desc" }`. `step` defaults to `1` and should be
positive: `direction` sets which way the range goes, not the sign of `step`. If `start >= end`, the range is
empty.

:::caution[Descending ranges count down from `end - 1`]
With `direction: "desc"`, the range starts at `end - 1` and counts down to `start`, so with a step it is
aligned to the end, not the start:

```ts
range(0, 10, { step: 2 }); // [0, 2, 4, 6, 8]
range(0, 10, { step: 2, direction: "desc" }); // [9, 7, 5, 3, 1]: not the reverse of the above
range(2, 10, { step: 3, direction: "desc" }); // [9, 6, 3]
```

To reverse an ascending range, use `range(...).reverse()`.
:::

Use `rangeLazy` when you don't want an array in memory, or when the range is unbounded:

```ts
async function firstFreeId() {
  for (const id of rangeLazy(1, Infinity)) {
    if (await isFree(id)) return id;
  }
}
```

## `enumerate`

`enumerate(iterable, start = 0)` yields `[index, value]` pairs, like Python's `enumerate`. It works with any
iterable (arrays, strings, `Set`, `Map`, generators), and you can choose the first index.

```ts
for (const [i, ch] of enumerate("abc")) {
  console.log(i, ch); // 0 "a", 1 "b", 2 "c"
}

[...enumerate(new Set(["x", "y"]))]; // [[0, "x"], [1, "y"]]
[...enumerate(["a", "b"], 1)]; // [[1, "a"], [2, "b"]]
```

It is [sync/async-adaptive](@BASE@/guides/sync-async-adaptive/). A sync iterable gives you a plain
`Generator` that you can spread or loop over with `for...of`. An `AsyncIterable` gives you an
`AsyncGenerator`, which you read with `for await`:

```ts
async function* rows() {
  yield { id: 1 };
  yield { id: 2 };
}

for await (const [i, row] of enumerate(rows())) {
  console.log(i, row.id); // 0 1, 1 2
}
```

Unlike `Array.prototype.entries()`, it works on any iterable, including ones that aren't arrays.

## `enumerateAsync`

`enumerateAsync(iterable, start = 0)` always returns an `AsyncGenerator` and reads the source with
`for await`. This matters for a **sync iterable of promises**. `enumerate` yields the promises themselves,
while `enumerateAsync` awaits each one, one after another and in order:

```ts
const users = [fetchUser(1), fetchUser(2)]; // an array of Promises

[...enumerate(users)]; // [[0, Promise], [1, Promise]]

for await (const [i, user] of enumerateAsync(users)) {
  console.log(i, user.name); // each value is awaited
}
```

Use `enumerate` when you want to attach indexes to the promises before you settle them yourself, for
example with `Promise.allSettled`. Use `enumerateAsync` when you want the resolved values.

## `toIterator`

`toIterator(source)` turns an `Iterable` or an `Iterator` into an `Iterator`. If `source` already has a
`next` method, it is returned as is. Otherwise its `[Symbol.iterator]()` is called. Use it when you need to
call `next()` by hand, for example to read a header row before the data:

```ts
const lines = toIterator(["name,age", "Ada,36", "Linus,54"]);

const header = lines.next().value; // "name,age"
for (let r = lines.next(); !r.done; r = lines.next()) {
  console.log(r.value); // "Ada,36", "Linus,54"
}
```

## `toAsyncIterable`

`toAsyncIterable(source)` turns any of `Iterable`, `Iterator`, `AsyncIterable` or `AsyncIterator` into an
`AsyncGenerator`. Use it in a function that should accept both sync and async sources and handle them with a
single `for await` loop:

```ts
import { asyncOf, toAsyncIterable } from "@xtandard/lib";

async function sum(source: Iterable<number> | AsyncIterable<number>) {
  let total = 0;
  for await (const n of toAsyncIterable(source)) total += n;
  return total;
}

await sum([1, 2, 3]); // 6
await sum(asyncOf(1, 2, 3)); // 6
```

It also accepts a bare iterator that is not iterable (an object with only `next()`), whether `next()` returns
results or promises of results. It calls `next()` once to find out which.

The result is always async: every value goes through the microtask queue, even when the source is a plain
array. If you only need to handle sync sources, use a plain `for...of` (or `enumerate`).
