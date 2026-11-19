/**
 * Check if a value has a `Symbol.asyncDispose` method (async disposable), i.e.
 * whether it can be bound with `await using`.
 *
 * Only objects pass: a function carrying the symbol returns `false`.
 *
 * @example
 * ```ts
 * import { defer, deferSync, isAsyncDisposable } from "@xtandard/lib";
 *
 * isAsyncDisposable(defer(() => {})); // true
 * isAsyncDisposable(deferSync(() => {})); // false (sync only)
 * isAsyncDisposable({ [Symbol.asyncDispose]: async () => {} }); // true
 * ```
 */
export const isAsyncDisposable = (value: unknown): value is AsyncDisposable =>
  typeof value === "object" &&
  value !== null &&
  Symbol.asyncDispose in value &&
  typeof (value as Record<symbol, unknown>)[Symbol.asyncDispose] === "function";

/**
 * Check if a value has a `Symbol.dispose` method (sync disposable), i.e.
 * whether it can be bound with `using`.
 *
 * Only objects pass: a function carrying the symbol returns `false`.
 *
 * @example
 * ```ts
 * import { defer, deferSync, isSyncDisposable } from "@xtandard/lib";
 *
 * isSyncDisposable(deferSync(() => {})); // true
 * isSyncDisposable(defer(() => {})); // false (async only)
 * isSyncDisposable({ [Symbol.dispose]() {} }); // true
 * ```
 */
export const isSyncDisposable = (value: unknown): value is Disposable =>
  typeof value === "object" &&
  value !== null &&
  Symbol.dispose in value &&
  typeof (value as Record<symbol, unknown>)[Symbol.dispose] === "function";

/**
 * Check if a value is disposable, sync or async: it has a `Symbol.dispose` or a
 * `Symbol.asyncDispose` method. Use it in generic cleanup code, then narrow with
 * {@link isAsyncDisposable} / {@link isSyncDisposable} to pick the call.
 *
 * @example Dispose whatever a value supports
 * ```ts
 * import { isAsyncDisposable, isDisposable } from "@xtandard/lib";
 *
 * async function disposeAll(values: unknown[]) {
 *   for (const value of values) {
 *     if (!isDisposable(value)) continue;
 *     if (isAsyncDisposable(value)) await value[Symbol.asyncDispose]();
 *     else value[Symbol.dispose]();
 *   }
 * }
 *
 * isDisposable({ [Symbol.dispose]() {} }); // true
 * isDisposable({}); // false
 * isDisposable(null); // false
 * ```
 */
export const isDisposable = (value: unknown): value is Disposable | AsyncDisposable =>
  isAsyncDisposable(value) || isSyncDisposable(value);
