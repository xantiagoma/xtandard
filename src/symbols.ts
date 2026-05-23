/** Check whether a disposable resource has already been disposed. */
export const DisposedSymbol: unique symbol = Symbol("disposed");

/** Check whether a deferred/disposable is enabled (will run on dispose). */
export const EnabledSymbol: unique symbol = Symbol("enabled");

/** Check whether a deferred/disposable has been canceled. */
export const CanceledSymbol: unique symbol = Symbol("canceled");

/** Access the cancel reason of a deferred/disposable. */
export const CancelReasonSymbol: unique symbol = Symbol("cancelReason");
