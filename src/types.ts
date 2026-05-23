/**
 * A value that can be either synchronous (`T`) or a thenable (`PromiseLike<T>`).
 */
export type MaybePromise<T> = T | PromiseLike<T>;
