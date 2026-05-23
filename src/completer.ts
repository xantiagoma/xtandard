import type { MaybePromise } from "./types";

/**
 * A small helper for "externally" resolving or rejecting a Promise.
 *
 * Useful when you need to bridge callback/event APIs to async/await.
 *
 * @example Resolve from another callback
 * ```ts
 * const completer = new Completer<string, Error>();
 *
 * setTimeout(() => {
 *   completer.resolve("done");
 * }, 10);
 *
 * const value = await completer.promise();
 * // value === "done"
 * ```
 *
 * @example Reset and reuse
 * ```ts
 * const completer = new Completer<number, Error>();
 *
 * completer.resolve(1);
 * await completer.promise(); // 1
 *
 * completer.reset();
 * completer.resolve(2);
 * await completer.promise(); // 2
 * ```
 */
export class Completer<T = unknown, E = unknown> {
  private _promise: Promise<T>;
  private _resolve!: (value: MaybePromise<T>) => void;
  private _reject!: (reason?: E) => void;

  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  resolve(value: MaybePromise<T>): void {
    this._resolve(value);
  }

  reject(reason: E): void {
    this._reject(reason);
  }

  promise(): Promise<T> {
    return this._promise;
  }

  reset(): void {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
}
