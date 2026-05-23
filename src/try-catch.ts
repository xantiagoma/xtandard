type MaybePromise<T> = T | Promise<T>;
type Result<T, E = Error> = [T, null] | [null, E];

/**
 * Convert a promise (or promise factory) into a tuple result: `[data, error]`.
 *
 * This is handy when you want to avoid `try/catch` at the call site.
 *
 * @example With a promise
 * ```ts
 * const [user, error] = await tryCatch(fetch("/api/me").then((r) => r.json()));
 *
 * if (error) {
 *   // handle error
 * } else {
 *   // use user
 * }
 * ```
 *
 * @example With a function (captures sync throws too)
 * ```ts
 * const [data, error] = await tryCatch(async () => {
 *   if (Math.random() > 0.5) {
 *     throw new Error("boom");
 *   }
 *   return 123;
 * });
 *
 * if (!error) {
 *   // data === 123
 * }
 * ```
 */
export async function tryCatch<T, E = Error>(
  promise: PromiseLike<T> | (() => MaybePromise<T>),
): Promise<Result<T, E>> {
  try {
    const data = await (typeof promise === "function" ? promise() : promise);
    return [data, null];
  } catch (error) {
    return [null, error as E];
  }
}

/**
 * Convert a sync function call into a tuple result: `[data, error]`.
 *
 * This is the sync equivalent of `tryCatch` and is handy when you want to avoid
 * `try/catch` at the call site.
 *
 * @example
 * ```ts
 * const [value, error] = tryCatchSync(() => JSON.parse('{"ok":true}'));
 *
 * if (error) {
 *   // handle error
 * } else {
 *   // value.ok === true
 * }
 * ```
 */
export function tryCatchSync<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return [fn(), null];
  } catch (error) {
    return [null, error as E];
  }
}
