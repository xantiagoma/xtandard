/**
 * Check if a value has a `Symbol.asyncDispose` method (async disposable).
 */
export const isAsyncDisposable = (value: unknown): value is AsyncDisposable =>
  typeof value === "object" &&
  value !== null &&
  Symbol.asyncDispose in value &&
  typeof (value as Record<symbol, unknown>)[Symbol.asyncDispose] === "function";

/**
 * Check if a value has a `Symbol.dispose` method (sync disposable).
 */
export const isSyncDisposable = (value: unknown): value is Disposable =>
  typeof value === "object" &&
  value !== null &&
  Symbol.dispose in value &&
  typeof (value as Record<symbol, unknown>)[Symbol.dispose] === "function";

/**
 * Check if a value is disposable (sync or async).
 */
export const isDisposable = (value: unknown): value is Disposable | AsyncDisposable =>
  isAsyncDisposable(value) || isSyncDisposable(value);
