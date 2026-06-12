import { isAsyncIterable } from "./is-async-iterable.ts";

function* enumerateSync<T>(iterable: Iterable<T>, start: number): Generator<[number, T]> {
  let index = start;
  for (const value of iterable) {
    yield [index, value];
    index += 1;
  }
}

/**
 * Yield `[index, value]` tuples for an iterable.
 *
 * Sync/async adaptive: an `AsyncIterable` produces an `AsyncGenerator`, a
 * sync `Iterable` produces a plain `Generator` you can drive without
 * `for await`.
 *
 * Note: for a *sync* iterable of Promises, values are yielded as-is. Use
 * `enumerateAsync` to await each value instead.
 *
 * @example Sync iterables — plain `Generator`, no `await` anywhere
 * ```ts
 * for (const [i, ch] of enumerate("abc")) {
 *   // [0, "a"], [1, "b"], [2, "c"]
 * }
 *
 * [...enumerate(["x", "y"])]; // [[0, "x"], [1, "y"]] — spreadable
 *
 * // works with any sync iterable: Set, Map, generators...
 * [...enumerate(new Set(["a", "b"]))]; // [[0, "a"], [1, "b"]]
 * ```
 *
 * @example Custom start index
 * ```ts
 * [...enumerate(["a", "b"], 5)]; // [[5, "a"], [6, "b"]]
 * ```
 *
 * @example Async iterables — `AsyncGenerator`, drive with `for await`
 * ```ts
 * async function* rows() {
 *   yield await db.row(1);
 *   yield await db.row(2);
 * }
 *
 * for await (const [i, row] of enumerate(rows())) {
 *   // [0, row1], [1, row2]
 * }
 * ```
 *
 * @example Sync iterable OF Promises — promises pass through untouched
 * ```ts
 * const promises = [fetchUser(1), fetchUser(2)]; // sync array of Promises
 *
 * [...enumerate(promises)];
 * // [[0, Promise], [1, Promise]] — indexes the promise objects themselves,
 * // handy when you need the index attached before settling them yourself;
 * // use `enumerateAsync` if you want each value awaited instead
 * ```
 */
export function enumerate<T>(
  iterable: AsyncIterable<T>,
  start?: number,
): AsyncGenerator<[number, T]>;
export function enumerate<T>(iterable: Iterable<T>, start?: number): Generator<[number, T]>;
export function enumerate<T>(
  iterable: Iterable<T> | AsyncIterable<T>,
  start?: number,
): Generator<[number, T]> | AsyncGenerator<[number, T]>;
export function enumerate<T>(
  iterable: Iterable<T> | AsyncIterable<T>,
  start = 0,
): Generator<[number, T]> | AsyncGenerator<[number, T]> {
  return isAsyncIterable(iterable)
    ? enumerateAsync(iterable, start)
    : enumerateSync(iterable, start);
}

/**
 * Always-async `enumerate`. Unlike `enumerate` on a sync iterable, this
 * `for await`s the source, so Promise values inside a sync iterable are
 * awaited (sequentially, in order) before being yielded.
 *
 * @example The difference from `enumerate`
 * ```ts
 * const promises = [fetchUser(1), fetchUser(2)]; // sync array OF Promises
 *
 * [...enumerate(promises)];
 * // [[0, Promise], [1, Promise]] — promises passed through as-is
 *
 * for await (const [i, user] of enumerateAsync(promises)) {
 *   // [0, { id: 1 }], [1, { id: 2 }] — each element awaited
 * }
 * ```
 */
export async function* enumerateAsync<T>(
  iterable: AsyncIterable<T> | Iterable<T>,
  start = 0,
): AsyncGenerator<[number, T]> {
  let index = start;
  for await (const value of iterable) {
    yield [index, value];
    index += 1;
  }
}
