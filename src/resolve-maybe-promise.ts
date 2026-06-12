import type { MaybePromise } from "./types";

import { isPromise } from "./is-promise";

/**
 * Resolve a value that might already be synchronous or might be a Promise.
 *
 * @example
 * ```ts
 * const value = await resolveMaybePromise(Math.random() > 0.5 ? 1 : Promise.resolve(1));
 * ```
 */
export const resolveMaybePromise = async <T>(value: MaybePromise<T>): Promise<T> =>
  isPromise(value) ? await value : value;

/**
 * Apply `fn` to a value that might be a Promise, staying synchronous when the
 * value is synchronous: a plain value is transformed immediately (no
 * microtask), a Promise is chained with `.then`.
 *
 * This is the building block for sync/async-adaptive utilities — compose
 * steps with it and an all-sync pipeline stays sync end to end.
 *
 * @example
 * ```ts
 * chainMaybePromise(1, (n) => n + 1); // 2 (sync)
 * chainMaybePromise(Promise.resolve(1), (n) => n + 1); // Promise<2>
 * ```
 */
export const chainMaybePromise = <T, R>(
  value: MaybePromise<T>,
  fn: (value: T) => MaybePromise<R>,
): MaybePromise<R> => (isPromise(value) ? value.then(fn) : fn(value as T));
