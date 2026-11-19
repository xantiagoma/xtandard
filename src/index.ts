/**
 * Isomorphic core utilities with zero dependencies: error handling, async
 * primitives, iterables, type guards, disposables, strings.
 *
 * Import from `@xtandard/lib`.
 *
 * @module core
 */

// Types
export type { MaybePromise } from "./types.ts";

// Error handling
export { tryCatch, tryCatchSync } from "./try-catch.ts";
export type { Result, TryCatchReturn } from "./try-catch.ts";
export { assertNotNull } from "./assert-not-null.ts";
export { valueOrThrow } from "./error.ts";
export { AssertError } from "./errors.ts";

// Type casting
export { cast } from "./cast.ts";

// Async utilities
export { wait } from "./wait.ts";
export { Completer } from "./completer.ts";
export { collect } from "./collect.ts";
export { asyncOf } from "./async-of.ts";
export { AsyncChannel } from "./async-channel.ts";
export { resolveMaybePromise, chainMaybePromise } from "./resolve-maybe-promise.ts";

// Iterables & generators
export { range, rangeLazy } from "./range.ts";
export { enumerate, enumerateAsync } from "./enumerate.ts";
export { toIterator } from "./to-iterator.ts";
export { toAsyncIterable } from "./to-async-iterable.ts";

// Type guards
export { isPromise } from "./is-promise.ts";
export { isIterable } from "./is-iterable.ts";
export { isAsyncIterable } from "./is-async-iterable.ts";
export { isIterator } from "./is-iterator.ts";
export { isGenerator } from "./is-generator.ts";
export { isAsyncGenerator } from "./is-async-generator.ts";
export { isDisposable, isAsyncDisposable, isSyncDisposable } from "./is-disposable.ts";

// Disposable utilities
export { defer, deferSync } from "./defer.ts";
export type { DeferOptions, Deferred, DeferredSync } from "./defer.ts";
export { makeDisposable } from "./make-disposable.ts";
export type { MakeDisposableOptions, Disposable as MadeDisposable } from "./make-disposable.ts";

// Strings
export {
  ensureString,
  naturalSortCompare,
  jaroWinklerSimilarity,
  jaroWinklerDistance,
} from "./string.ts";

// Stream
export { resolveStreamSource } from "./stream-source.ts";
export type { StreamSource, StreamSourceInstance } from "./stream-source.ts";

// Symbols
export { DisposedSymbol, EnabledSymbol, CanceledSymbol, CancelReasonSymbol } from "./symbols.ts";

// Time
export { secondsToMs, minutesToMs, hoursToMs } from "./time-convert.ts";

// DataLoader helpers
export { prepareLoaderResult } from "./prepare-loader-result.ts";
export type {
  PrepareLoaderResultOneOptions,
  PrepareLoaderResultManyOptions,
} from "./prepare-loader-result.ts";

// Debug
export { log } from "./log.ts";
