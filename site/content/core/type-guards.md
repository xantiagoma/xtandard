---
title: "Type guards"
description: "Runtime checks that narrow unknown values to promises, iterables, iterators, generators and disposables."
---

These guards check a value at runtime and narrow its TypeScript type. They test for a protocol (the method or
symbol that makes something a promise, an iterable or a disposable), not for a specific class. Use them in
functions that accept "anything iterable" or "a value or a promise" and need to choose a code path.

```ts
import {
  isPromise,
  isIterable,
  isAsyncIterable,
  isIterator,
  isGenerator,
  isAsyncGenerator,
  isDisposable,
  isAsyncDisposable,
  isSyncDisposable,
} from "@xtandard/lib";
```

| Guard                      | Narrows to                      | Checks for                                                   |
| -------------------------- | ------------------------------- | ------------------------------------------------------------ |
| `isPromise(value)`         | `Promise<T>`                    | a `Promise` instance, or any object with a `then` method     |
| `isIterable(value)`        | `Iterable<T>`                   | an object with a `[Symbol.iterator]` method                  |
| `isAsyncIterable(value)`   | `AsyncIterable<T>`              | an object with a `[Symbol.asyncIterator]` method             |
| `isIterator(value)`        | `Iterator<T>`                   | an object with a `next` method                               |
| `isGenerator(value)`       | `Generator<T, TReturn>`         | `next`, `return` and `throw` methods, and not async-iterable |
| `isAsyncGenerator(value)`  | `AsyncGenerator<T, TReturn>`    | `[Symbol.asyncIterator]`, `next` and `return`                |
| `isSyncDisposable(value)`  | `Disposable`                    | a `[Symbol.dispose]` method                                  |
| `isAsyncDisposable(value)` | `AsyncDisposable`               | a `[Symbol.asyncDispose]` method                             |
| `isDisposable(value)`      | `Disposable \| AsyncDisposable` | either of the above                                          |

## `isPromise`

`isPromise` returns `true` for native promises and for any other "thenable" (an object with a `then`
function). It is the check that sync/async-adaptive code uses to decide which path to take.

```ts
import { isPromise } from "@xtandard/lib";

function format(value: number | Promise<number>) {
  if (isPromise(value)) {
    return value.then((n) => n.toFixed(2)); // value: Promise<number>
  }
  return value.toFixed(2); // value: number
}
```

It narrows to `Promise<T>` even when the value is only a thenable. Use the result only as something you can
`await` or call `.then` on; don't rely on `.catch` or `.finally` being there.

:::caution[Narrowing a `MaybePromise`]
`MaybePromise<T>` is `T | PromiseLike<T>`, and the guard narrows to `Promise<T>`. So in the `false` branch,
TypeScript still includes `PromiseLike<T>` and does not narrow the value to `T`. When the input is a
`MaybePromise<T>`, cast the `false` branch (`value as T`), or use
[`chainMaybePromise`](@BASE@/core/async/#maybepromise-resolvemaybepromise-chainmaybepromise), which handles
both cases for you.
:::

## `isIterable` and `isAsyncIterable`

```ts
function toArray<T>(value: T | Iterable<T>): T[] {
  return isIterable<T>(value) ? [...value] : [value];
}

toArray([1, 2]); // [1, 2]
toArray(new Set([1, 2])); // [1, 2]
toArray(1); // [1]
```

The type parameter only sets the element type of the narrowed value; it isn't checked at runtime.

:::caution[Strings are not "iterable" here]
Both guards require an **object**, so primitive strings fail, even though `for...of` works on them:

```ts
isIterable("abc"); // false
isIterable(["abc"]); // true
```

This is usually what you want: in `toArray` above, a string is treated as a single value instead of being
split into characters. If you want strings to count, check `typeof value === "string"` as well.
:::

`isAsyncIterable` matches async generators, `AsyncChannel` and any object with `Symbol.asyncIterator`. A
sync iterable of promises does _not_ match.

## `isIterator`

`isIterator` only checks for a `next` method. Generators, array iterators (`[][Symbol.iterator]()`) and
hand-written `{ next() {...} }` objects all pass. Async iterators pass too, because they have a `next` method
as well. To tell sync from async, check `isAsyncIterable` first, as
[`toAsyncIterable`](@BASE@/core/iterables/#toasynciterable) does.

## `isGenerator` and `isAsyncGenerator`

These guards tell a generator object apart from a plain iterator. `isGenerator` requires `next`, `return`
and `throw`, and rejects anything async-iterable. `isAsyncGenerator` requires `Symbol.asyncIterator`, `next`
and `return`.

```ts
function* gen() {
  yield 1;
}
async function* agen() {
  yield 1;
}

isGenerator(gen()); // true
isGenerator(agen()); // false
isGenerator([1, 2][Symbol.iterator]()); // false: no return/throw
isAsyncGenerator(agen()); // true
isAsyncGenerator(gen()); // false
```

You can pass the yield and return types: `isGenerator<number, string>(value)` narrows to
`Generator<number, string, unknown>`.

Use these guards when you need the generator-only methods, for example `gen.return()` to stop a generator
early and run its `finally` blocks.

## `isDisposable`, `isAsyncDisposable`, `isSyncDisposable`

These guards check for the [explicit resource management](@BASE@/core/disposables/) protocols:
`Symbol.dispose` (used by `using`) and `Symbol.asyncDispose` (used by `await using`).

```ts
async function release(resource: unknown) {
  if (isAsyncDisposable(resource)) await resource[Symbol.asyncDispose]();
  else if (isSyncDisposable(resource)) resource[Symbol.dispose]();
}
```

`isDisposable` accepts either kind. The two specific guards are separate, and xtandard's own helpers only
implement one protocol each: `defer` and `makeDisposable` are async-disposable, and `deferSync` is
sync-disposable.

```ts
import { defer, deferSync } from "@xtandard/lib";

isAsyncDisposable(defer(() => {})); // true
isSyncDisposable(defer(() => {})); // false
isSyncDisposable(deferSync(() => {})); // true
isDisposable(deferSync(() => {})); // true
```

`makeDisposable` uses `isAsyncDisposable` to refuse objects that already have a dispose method.
