/**
 * Sleep for a given amount of time.
 *
 * If you pass a `value`, it resolves with that value after the delay (keeping the type).
 *
 * @example Delay a side effect
 * ```ts
 * await wait(250);
 * console.log("250ms later");
 * ```
 *
 * @example Delay a typed value
 * ```ts
 * const value = await wait(100, { ok: true as const });
 * // value: { ok: true }
 * ```
 */
export function wait(ms: number): Promise<void>;
export function wait<T>(ms: number, value: T): Promise<T>;
export function wait<T>(ms: number, value?: T | undefined): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve) =>
    setTimeout(() => (value === undefined ? resolve(undefined) : resolve(value)), ms),
  );
}
