/**
 * Collect all values from an `AsyncIterable` into an array.
 *
 * @example
 * ```ts
 * async function* gen() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * const values = await collect(gen()); // [1, 2]
 * ```
 */
export async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const v of source) {
    values.push(v);
  }
  return values;
}
