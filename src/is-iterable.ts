/**
 * Type guard for `Iterable`.
 *
 * @example
 * ```ts
 * const value: unknown = [1, 2, 3];
 *
 * if (isIterable<number>(value)) {
 *   for (const n of value) {
 *     // n: number
 *   }
 * }
 * ```
 */
export const isIterable = <T = unknown>(value: unknown): value is Iterable<T> =>
  typeof value === "object" &&
  value !== null &&
  Symbol.iterator in value &&
  typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === "function";
