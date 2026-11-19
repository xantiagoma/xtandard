---
title: "Core utilities"
description: "The zero-dependency, isomorphic core of @xtandard/lib: error handling, async primitives, iterables, type guards, disposables and string helpers."
---

The core is what you get from the bare `@xtandard/lib` import: small building blocks for error handling, async
code, iterables, resource cleanup and strings. It has **no dependencies** and uses only standard JavaScript,
so the same code runs in Node, Bun, Deno, browsers and edge runtimes.

```ts
import { tryCatch, AsyncChannel, enumerate, defer } from "@xtandard/lib";
```

The sub-entry points (`@xtandard/lib/interval`, `@xtandard/lib/pagination`, `@xtandard/lib/filters`, …) build on these
utilities. Their dependencies are optional peers, so importing the core never pulls them in.

## What's in it

| Category               | Exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Page                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Error handling         | [`tryCatch`](@BASE@/api/core/functions/trycatch/), [`tryCatchSync`](@BASE@/api/core/functions/trycatchsync/) (deprecated), [`assertNotNull`](@BASE@/api/core/functions/assertnotnull/), [`valueOrThrow`](@BASE@/api/core/functions/valueorthrow/), [`AssertError`](@BASE@/api/core/classes/asserterror/)                                                                                                                                                                                                                                                          | [Error handling](@BASE@/core/error-handling/)    |
| Async                  | [`wait`](@BASE@/api/core/functions/wait/), [`Completer`](@BASE@/api/core/classes/completer/), [`collect`](@BASE@/api/core/functions/collect/), [`asyncOf`](@BASE@/api/core/functions/asyncof/), [`AsyncChannel`](@BASE@/api/core/classes/asyncchannel/), [`resolveMaybePromise`](@BASE@/api/core/functions/resolvemaybepromise/), [`chainMaybePromise`](@BASE@/api/core/functions/chainmaybepromise/), [`MaybePromise`](@BASE@/api/core/type-aliases/maybepromise/)                                                                                               | [Async](@BASE@/core/async/)                      |
| Iterables & generators | [`range`](@BASE@/api/core/functions/range/), [`rangeLazy`](@BASE@/api/core/functions/rangelazy/), [`enumerate`](@BASE@/api/core/functions/enumerate/), [`enumerateAsync`](@BASE@/api/core/functions/enumerateasync/), [`toIterator`](@BASE@/api/core/functions/toiterator/), [`toAsyncIterable`](@BASE@/api/core/functions/toasynciterable/)                                                                                                                                                                                                                      | [Iterables & generators](@BASE@/core/iterables/) |
| Type guards            | [`isPromise`](@BASE@/api/core/functions/ispromise/), [`isIterable`](@BASE@/api/core/functions/isiterable/), [`isAsyncIterable`](@BASE@/api/core/functions/isasynciterable/), [`isIterator`](@BASE@/api/core/functions/isiterator/), [`isGenerator`](@BASE@/api/core/functions/isgenerator/), [`isAsyncGenerator`](@BASE@/api/core/functions/isasyncgenerator/), [`isDisposable`](@BASE@/api/core/functions/isdisposable/), [`isAsyncDisposable`](@BASE@/api/core/functions/isasyncdisposable/), [`isSyncDisposable`](@BASE@/api/core/functions/issyncdisposable/) | [Type guards](@BASE@/core/type-guards/)          |
| Disposables            | [`defer`](@BASE@/api/core/functions/defer/), [`deferSync`](@BASE@/api/core/functions/defersync/), [`makeDisposable`](@BASE@/api/core/functions/makedisposable/), [`DisposedSymbol`](@BASE@/api/core/variables/disposedsymbol/), [`EnabledSymbol`](@BASE@/api/core/variables/enabledsymbol/), [`CanceledSymbol`](@BASE@/api/core/variables/canceledsymbol/), [`CancelReasonSymbol`](@BASE@/api/core/variables/cancelreasonsymbol/)                                                                                                                                 | [Disposables](@BASE@/core/disposables/)          |
| Strings                | [`ensureString`](@BASE@/api/core/functions/ensurestring/), [`naturalSortCompare`](@BASE@/api/core/functions/naturalsortcompare/), [`jaroWinklerDistance`](@BASE@/api/core/functions/jarowinklerdistance/)                                                                                                                                                                                                                                                                                                                                                         | [Strings](@BASE@/core/strings/)                  |
| Misc                   | [`cast`](@BASE@/api/core/functions/cast/), [`log`](@BASE@/api/core/functions/log/), [`secondsToMs`](@BASE@/api/core/functions/secondstoms/), [`minutesToMs`](@BASE@/api/core/functions/minutestoms/), [`hoursToMs`](@BASE@/api/core/functions/hourstoms/), [`prepareLoaderResult`](@BASE@/api/core/functions/prepareloaderresult/), [`resolveStreamSource`](@BASE@/api/core/functions/resolvestreamsource/), [`StreamSource`](@BASE@/api/core/type-aliases/streamsource/)                                                                                         | [Misc](@BASE@/core/misc/)                        |

The full signatures are in the [core API reference](@BASE@/api/core/).

## Zero dependencies, isomorphic

The core imports nothing outside the library. It relies only on language features: Promises, iterators,
async generators, `Symbol.dispose` / `Symbol.asyncDispose` and `Intl` string comparison. It doesn't touch the
DOM, `node:*` modules or `process`, so it is safe to import in shared frontend and backend code. Helpers that
need a third-party library (DataLoader, React, Temporal, …) live in their own entry points. See
[Entry points](@BASE@/guides/entry-points/).

## Sync/async-adaptive APIs

Several core functions are **as synchronous as their input**. Give them sync input and you get a plain value
back, with no `await` and no microtask. Give them async input and you get a Promise. The return type reflects
which one you get, so you always know whether to `await`.

```ts
import { tryCatch, collect, enumerate } from "@xtandard/lib";

const [config, error] = tryCatch(() => JSON.parse(raw)); // sync function → tuple, no await
const [user, fetchError] = await tryCatch(fetch("/api/me")); // promise → Promise<tuple>

collect(new Set([1, 2])); // number[]
await collect(asyncRows()); // Promise<Row[]>

for (const [i, ch] of enumerate("abc")) {
} // Generator
for await (const [i, row] of enumerate(asyncRows())) {
} // AsyncGenerator
```

`await` still works on the sync results (awaiting a plain value is a no-op), so code that doesn't care can
always `await`. The building blocks, `MaybePromise`, `isPromise`, `chainMaybePromise` and
`resolveMaybePromise`, are exported too, so you can write your own adaptive utilities. The
[Sync/async-adaptive APIs guide](@BASE@/guides/sync-async-adaptive/) explains the rules and gives recipes.
