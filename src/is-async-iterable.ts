/**
 * Type guard for `AsyncIterable`.
 *
 * Works for `AsyncIterable` values like `AsyncGenerator`, async iterators returned from
 * `async function*`, and objects that implement `Symbol.asyncIterator`.
 *
 * @example
 * ```ts
 * const value: unknown = (async function* () {
 *   yield 1;
 * })();
 *
 * if (isAsyncIterable<number>(value)) {
 *   for await (const n of value) {
 *     // n: number
 *   }
 * }
 * ```
 */
export const isAsyncIterable = <T = unknown>(value: unknown): value is AsyncIterable<T> =>
  typeof value === "object" &&
  value !== null &&
  Symbol.asyncIterator in value &&
  typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function";
