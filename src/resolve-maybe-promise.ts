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
