import type { MaybePromise } from "./types.ts";
import { isAsyncIterable } from "./is-async-iterable.ts";

/**
 * Collect all values from an iterable into an array.
 *
 * Sync/async adaptive: an `AsyncIterable` returns a `Promise<T[]>`, a sync
 * `Iterable` returns `T[]` directly — no `await` needed (and `await` still
 * works on both).
 *
 * @example Async source
 * ```ts
 * async function* gen() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * const values = await collect(gen()); // [1, 2]
 * ```
 *
 * @example Sync source — result is immediate
 * ```ts
 * const values = collect(new Set([1, 2])); // [1, 2], no await
 * ```
 */
export function collect<T>(source: AsyncIterable<T>): Promise<T[]>;
export function collect<T>(source: Iterable<T>): T[];
export function collect<T>(source: AsyncIterable<T> | Iterable<T>): MaybePromise<T[]>;
export function collect<T>(source: AsyncIterable<T> | Iterable<T>): MaybePromise<T[]> {
  if (isAsyncIterable(source)) {
    return (async () => {
      const values: T[] = [];
      for await (const v of source) {
        values.push(v);
      }
      return values;
    })();
  }
  return [...source];
}
