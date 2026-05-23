import { isAsyncIterable } from "./is-async-iterable";
import { isIterable } from "./is-iterable";
import { isIterator } from "./is-iterator";
import { isPromise } from "./is-promise";

/**
 * Convert an `Iterable`/`Iterator`/`AsyncIterable`/`AsyncIterator` into an `AsyncIterable`.
 *
 * Useful for utilities that want to accept both sync and async sources.
 *
 * @example
 * ```ts
 * async function* source() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * for await (const n of toAsyncIterable(source())) {
 *   // n: number
 * }
 * ```
 */
export async function* toAsyncIterable<T>(
  source: Iterable<T> | Iterator<T> | AsyncIterable<T> | AsyncIterator<T>,
): AsyncGenerator<T> {
  if (isAsyncIterable<T>(source)) {
    for await (const value of source) {
      yield value;
    }
    return;
  }

  if (isIterator<T>(source) && !isIterable<T>(source)) {
    const firstNext = (source as { next: () => unknown }).next() as
      | IteratorResult<T>
      | Promise<IteratorResult<T>>;

    if (isPromise(firstNext)) {
      const asyncIterator = source as unknown as AsyncIterator<T>;
      for (let next = await firstNext; !next.done; next = await asyncIterator.next()) {
        yield next.value;
      }
      return;
    }

    const iterator = source as Iterator<T>;
    for (let next = firstNext as IteratorResult<T>; !next.done; next = iterator.next()) {
      yield next.value;
    }
    return;
  }

  for (const value of source as Iterable<T>) {
    yield value;
  }
}
