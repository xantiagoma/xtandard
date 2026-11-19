import type { MaybePromise } from "./types";

/**
 * A small helper for "externally" resolving or rejecting a Promise.
 *
 * Useful when you need to bridge callback/event APIs to async/await: create it,
 * hand `completer.promise()` to whoever waits, and call `resolve` or `reject`
 * later from a callback, an event handler or another task. `reset()` makes it
 * reusable.
 *
 * @example Resolve from another callback
 * ```ts
 * import { Completer } from "@xtandard/lib";
 *
 * const completer = new Completer<string, Error>();
 *
 * setTimeout(() => {
 *   completer.resolve("done");
 * }, 10);
 *
 * const value = await completer.promise(); // "done"
 * ```
 *
 * @example Bridge events to await
 * ```ts
 * const opened = new Completer<void, Event>();
 *
 * socket.addEventListener("open", () => opened.resolve());
 * socket.addEventListener("error", (event) => opened.reject(event));
 *
 * await opened.promise(); // continues once the socket is open, throws on error
 * ```
 */
export class Completer<T = unknown, E = unknown> {
  private _promise: Promise<T>;
  private _resolve!: (value: MaybePromise<T>) => void;
  private _reject!: (reason?: E) => void;

  /**
   * Create a completer with a new pending promise.
   *
   * @example
   * ```ts
   * const ready = new Completer<string, Error>(); // T = value type, E = rejection type
   * ```
   */
  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  /**
   * Resolve the current promise with `value`. Passing a promise (or thenable)
   * makes the completer follow it. Like a normal Promise, only the first
   * `resolve`/`reject` counts; later calls do nothing until {@link reset}.
   *
   * @example
   * ```ts
   * const done = new Completer<number>();
   *
   * done.resolve(1);
   * done.resolve(2); // ignored: already resolved
   * await done.promise(); // 1
   *
   * const followed = new Completer<number>();
   * followed.resolve(Promise.resolve(42));
   * await followed.promise(); // 42
   * ```
   */
  resolve(value: MaybePromise<T>): void {
    this._resolve(value);
  }

  /**
   * Reject the current promise with `reason`. Only the first
   * `resolve`/`reject` counts; later calls do nothing until {@link reset}.
   *
   * @example Reject on timeout
   * ```ts
   * import { Completer, tryCatch } from "@xtandard/lib";
   *
   * const reply = new Completer<string, Error>();
   * setTimeout(() => reply.reject(new Error("timeout")), 5_000);
   *
   * const [, error] = await tryCatch(reply.promise());
   * error?.message; // "timeout" (if nothing resolved it first)
   * ```
   */
  reject(reason: E): void {
    this._reject(reason);
  }

  /**
   * The current promise. Every call returns the same promise until
   * {@link reset} replaces it, so hand it to as many waiters as you like.
   *
   * @example
   * ```ts
   * const ready = new Completer<void>();
   *
   * const a = ready.promise().then(() => console.log("a"));
   * const b = ready.promise().then(() => console.log("b"));
   * ready.promise() === ready.promise(); // true
   *
   * ready.resolve();
   * await Promise.all([a, b]); // logs a, b
   * ```
   */
  promise(): Promise<T> {
    return this._promise;
  }

  /**
   * Replace the promise with a new pending one, so the completer can be settled
   * again. If the old promise is still pending, it is rejected with
   * `Error("Completer was reset")`, so nothing awaiting it hangs. (That
   * rejection is not reported as unhandled when nobody awaits the old promise.)
   * An already-settled promise keeps its result.
   *
   * @example Reuse after settling
   * ```ts
   * const tick = new Completer<number>();
   *
   * tick.resolve(1);
   * await tick.promise(); // 1
   *
   * tick.reset();
   * tick.resolve(2);
   * await tick.promise(); // 2
   * ```
   *
   * @example Reset while someone waits
   * ```ts
   * const reply = new Completer<string>();
   * const waiting = reply.promise();
   *
   * reply.reset();
   * await waiting; // throws Error("Completer was reset")
   * ```
   */
  reset(): void {
    // Rejecting a settled promise is a no-op; the noop catch keeps an unawaited
    // pending promise from surfacing as an unhandled rejection.
    this._promise.catch(() => {});
    this._reject(new Error("Completer was reset") as E);
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
}
