import type { MaybePromise } from "./types.ts";
import { isPromise } from "./is-promise.ts";

type Result<T, E = Error> = [T, null] | [null, E];

/** `true` only for `any` (the `1 & T` intersection trick). */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Return type of `tryCatch` for a function input: distributes over
 * `MaybePromise` unions, so `() => T` yields `Result<T, E>`,
 * `() => Promise<T>` yields `Promise<Result<T, E>>`, and
 * `() => MaybePromise<T>` yields the union of both.
 *
 * `any` (e.g. `JSON.parse`) and `never` (a function that always throws) are
 * guarded explicitly — both would otherwise poison the distributive
 * conditional and make the result non-destructurable.
 */
export type TryCatchReturn<R, E = Error> =
  IsAny<R> extends true
    ? Result<R, E>
    : [R] extends [never]
      ? Result<never, E>
      : R extends PromiseLike<infer U>
        ? Promise<Result<U, E>>
        : Result<R, E>;

/**
 * Convert a promise (or function) into a tuple result: `[data, error]`.
 *
 * This is handy when you want to avoid `try/catch` at the call site.
 *
 * Sync/async adaptive: a promise input or async function returns a
 * `Promise<Result>`; a sync function returns the `Result` tuple directly —
 * no `await` needed (and `await` still works on both).
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
 * @example With a sync function — result is immediate
 * ```ts
 * const [value, error] = tryCatch(() => JSON.parse('{"ok":true}')); // no await
 * ```
 *
 * @example With an async function (captures sync throws too)
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
export function tryCatch<T, E = Error>(promise: PromiseLike<T>): Promise<Result<T, E>>;
export function tryCatch<R, E = Error>(fn: () => R): TryCatchReturn<R, E>;
export function tryCatch<T, E = Error>(
  input: PromiseLike<T> | (() => MaybePromise<T>),
): MaybePromise<Result<T, E>>;
export function tryCatch<T, E = Error>(
  input: PromiseLike<T> | (() => MaybePromise<T>),
): MaybePromise<Result<T, E>> {
  if (typeof input !== "function") {
    return Promise.resolve(input).then(
      (data): Result<T, E> => [data, null],
      (error): Result<T, E> => [null, error as E],
    );
  }
  try {
    const result = input();
    if (isPromise(result)) {
      return result.then(
        (data): Result<T, E> => [data, null],
        (error): Result<T, E> => [null, error as E],
      );
    }
    return [result as T, null];
  } catch (error) {
    return [null, error as E];
  }
}

/**
 * Convert a sync function call into a tuple result: `[data, error]`.
 *
 * @deprecated `tryCatch` is now sync/async adaptive and returns the tuple
 * synchronously for sync functions — use it instead. Kept only for backwards
 * compatibility; will be removed in a future major.
 *
 * @example
 * ```ts
 * const [value, error] = tryCatch(() => JSON.parse('{"ok":true}')); // same behavior
 * ```
 */
export function tryCatchSync<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return [fn(), null];
  } catch (error) {
    return [null, error as E];
  }
}
