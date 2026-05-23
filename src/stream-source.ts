/**
 * All stream source types we accept as instances.
 *
 * Includes sync and async iterables, iterators, and generators.
 */
export type StreamSourceInstance<T> =
  | AsyncGenerator<T, unknown, unknown>
  | AsyncIterator<T>
  | AsyncIterable<T>
  | Generator<T, unknown, unknown>
  | Iterator<T>
  | Iterable<T>;

/**
 * A stream source can be an instance OR a factory function that creates one.
 *
 * Factory functions are useful when you want to defer creation of the stream,
 * or when the same stream needs to be re-created multiple times.
 *
 * @example
 * ```ts
 * // Instance
 * const source: StreamSource<number> = [1, 2, 3];
 *
 * // Factory function
 * const source: StreamSource<number> = () => generateNumbers();
 * ```
 */
export type StreamSource<T> = StreamSourceInstance<T> | (() => StreamSourceInstance<T>);

/**
 * Resolve a stream source - calls the factory if it's a function, otherwise
 * returns the instance directly.
 *
 * @example
 * ```ts
 * function* gen() { yield 1; yield 2; }
 *
 * // Works with factory
 * const source1 = resolveStreamSource(gen);
 * // Works with instance
 * const source2 = resolveStreamSource(gen());
 * ```
 */
export function resolveStreamSource<T>(source: StreamSource<T>): StreamSourceInstance<T> {
  return typeof source === "function" ? source() : source;
}
