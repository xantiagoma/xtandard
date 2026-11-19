import type { MaybePromise } from "./types";

/**
 * Type guard for Promise-like values (thenables).
 * Uses instanceof first (fast path), then duck-typing for non-native thenables.
 *
 * Narrows both branches: a `MaybePromise<T>` (`T | PromiseLike<T>`) becomes
 * `PromiseLike<T>` when true and `T` when false, also when `T` is a type
 * parameter. A `T | Promise<T>` input keeps `Promise<T>` in the true branch.
 *
 * @example
 * ```ts
 * const value: MaybePromise<string> = getData();
 *
 * if (isPromise(value)) {
 *   const s = await value; // value: PromiseLike<string>, s: string
 * } else {
 *   value; // string
 * }
 * ```
 */
export const isPromise = <T>(value: MaybePromise<T>): value is PromiseLike<T> =>
  value instanceof Promise ||
  (typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function");
