import { isIterator } from "./is-iterator";

/**
 * Convert an `Iterable` or `Iterator` into an `Iterator`.
 *
 * @example
 * ```ts
 * const iterator = toIterator([1, 2, 3]);
 * iterator.next(); // { value: 1, done: false }
 * ```
 */
export const toIterator = <T>(source: Iterable<T> | Iterator<T>): Iterator<T> =>
  isIterator<T>(source) ? source : source[Symbol.iterator]();
