/**
 * Create an `AsyncIterable` from a list of values.
 *
 * @example
 * ```ts
 * for await (const n of asyncOf(1, 2, 3)) {
 *   console.log(n); // 1, 2, 3
 * }
 * ```
 */
export async function* asyncOf<T>(...values: T[]): AsyncGenerator<T> {
  for (const v of values) {
    yield v;
  }
}
