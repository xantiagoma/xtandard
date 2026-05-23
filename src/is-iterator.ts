/**
 * Type guard for `Iterator`.
 *
 * @example
 * ```ts
 * const value: unknown = [1, 2, 3][Symbol.iterator]();
 *
 * if (isIterator<number>(value)) {
 *   value.next(); // IteratorResult<number>
 * }
 * ```
 */
export const isIterator = <T = unknown>(value: unknown): value is Iterator<T> =>
  typeof value === "object" &&
  value !== null &&
  "next" in value &&
  typeof (value as { next?: unknown }).next === "function";
