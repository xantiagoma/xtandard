import type { MaybePromise } from "./types";

/**
 * Type guard for Promise-like values (thenables).
 * Uses instanceof first (fast path), then duck-typing for non-native thenables.
 *
 * @example
 * ```ts
 * const value: MaybePromise<string> = getData();
 *
 * if (isPromise(value)) {
 *   const n = await value; // Promise<string>
 * } else {
 *   value; // string
 * }
 * ```
 */
export const isPromise = <T>(value: MaybePromise<T>): value is Promise<T> =>
  value instanceof Promise ||
  (typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function");
