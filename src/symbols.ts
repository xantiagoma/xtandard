/**
 * Symbol key for whether a disposable has already been disposed. Available on
 * `defer`, `deferSync` and `makeDisposable` results. A symbol (rather than a
 * `disposed` property) can't collide with the resource's own fields, which
 * matters for `makeDisposable`, since it adds state to your object.
 *
 * @example
 * ```ts
 * import { DisposedSymbol, makeDisposable } from "@xtandard/lib";
 *
 * const conn = await makeDisposable(openConnection(), { onDispose: (c) => c.close() });
 *
 * conn[DisposedSymbol]; // false
 * await conn[Symbol.asyncDispose]();
 * conn[DisposedSymbol]; // true
 * ```
 */
export const DisposedSymbol: unique symbol = Symbol("disposed");

/**
 * Symbol key for whether a `defer`/`deferSync` is enabled: `true` while
 * disposing would still run its cleanup (not canceled, not yet disposed). Same
 * value as its `.enabled` property.
 *
 * @example
 * ```ts
 * import { EnabledSymbol, defer } from "@xtandard/lib";
 *
 * const cleanup = defer(() => console.log("cleanup"));
 *
 * cleanup[EnabledSymbol]; // true
 * cleanup.cancel();
 * cleanup[EnabledSymbol]; // false
 * ```
 */
export const EnabledSymbol: unique symbol = Symbol("enabled");

/**
 * Symbol key for whether a `defer`/`deferSync` has been canceled (by
 * `cancel()` or an aborted `signal`), until `resume()`. Same value as its
 * `.canceled` property.
 *
 * @example
 * ```ts
 * import { CanceledSymbol, defer } from "@xtandard/lib";
 *
 * const rollback = defer(() => db.query("ROLLBACK"));
 *
 * rollback[CanceledSymbol]; // false
 * rollback.cancel("committed");
 * rollback[CanceledSymbol]; // true
 * ```
 */
export const CanceledSymbol: unique symbol = Symbol("canceled");

/**
 * Symbol key for the reason passed to the last `cancel(reason)` of a
 * `defer`/`deferSync` (or the signal's abort reason), or `undefined`. Same value
 * as its `.cancelReason` property; `resume()` clears it.
 *
 * @example
 * ```ts
 * import { CancelReasonSymbol, defer } from "@xtandard/lib";
 *
 * const rollback = defer(() => db.query("ROLLBACK"));
 *
 * rollback.cancel("committed");
 * rollback[CancelReasonSymbol]; // "committed"
 * rollback.resume();
 * rollback[CancelReasonSymbol]; // undefined
 * ```
 */
export const CancelReasonSymbol: unique symbol = Symbol("cancelReason");
