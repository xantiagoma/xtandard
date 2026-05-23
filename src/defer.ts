import type { MaybePromise } from "./types";

import { CanceledSymbol, CancelReasonSymbol, DisposedSymbol, EnabledSymbol } from "./symbols";

export interface DeferOptions {
  signal?: AbortSignal;
  onDispose?: () => void;
  onCancel?: (reason?: unknown) => void;
}

export interface Deferred {
  /** Cancel — dispose becomes a no-op. Pass an optional reason. */
  cancel: (reason?: unknown) => void;
  /** Re-enable after cancel. */
  resume: () => void;
  /** Run the deferred function (once). No-op if canceled or already disposed. */
  dispose: () => MaybePromise<void>;
  readonly enabled: boolean;
  readonly [EnabledSymbol]: boolean;
  readonly disposed: boolean;
  readonly [DisposedSymbol]: boolean;
  readonly canceled: boolean;
  readonly [CanceledSymbol]: boolean;
  readonly cancelReason: unknown;
  readonly [CancelReasonSymbol]: unknown;
  [Symbol.asyncDispose]: () => Promise<void>;
}

export interface DeferredSync {
  cancel: (reason?: unknown) => void;
  resume: () => void;
  dispose: () => void;
  readonly enabled: boolean;
  readonly [EnabledSymbol]: boolean;
  readonly disposed: boolean;
  readonly [DisposedSymbol]: boolean;
  readonly canceled: boolean;
  readonly [CanceledSymbol]: boolean;
  readonly cancelReason: unknown;
  readonly [CancelReasonSymbol]: unknown;
  [Symbol.dispose]: () => void;
}

/**
 * Creates an async disposable with cancellation, resume, and double-dispose protection.
 *
 * @example Basic usage
 * ```ts
 * await using cleanup = defer(async () => {
 *   await closeConnection();
 * });
 * ```
 *
 * @example With AbortSignal
 * ```ts
 * const controller = new AbortController();
 * await using cleanup = defer(async () => {
 *   await closeConnection();
 * }, { signal: controller.signal });
 *
 * controller.abort(); // cleanup is now canceled
 * ```
 *
 * @example With onDispose callback
 * ```ts
 * await using cleanup = defer(async () => {
 *   await closeConnection();
 * }, { onDispose: () => console.log("disposed") });
 * ```
 *
 * @example Cancel with reason
 * ```ts
 * const d = defer(() => { ... });
 * d.cancel("no longer needed");
 * d.cancelReason; // "no longer needed"
 * ```
 */
export const defer = (fn: () => MaybePromise<void>, options?: DeferOptions): Deferred => {
  let enabled = true;
  let disposed = false;
  let cancelReason: unknown;

  const cancel = (reason?: unknown) => {
    enabled = false;
    cancelReason = reason;
    options?.onCancel?.(reason);
  };

  const resume = () => {
    if (!disposed) {
      enabled = true;
      cancelReason = undefined;
    }
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      cancel(options.signal.reason);
    } else {
      options.signal.addEventListener("abort", () => cancel(options.signal!.reason), {
        once: true,
      });
    }
  }

  const run = async () => {
    if (!enabled || disposed) return;
    disposed = true;
    await fn();
    options?.onDispose?.();
  };

  return {
    cancel,
    resume,
    dispose: run,
    get enabled() {
      return enabled && !disposed;
    },
    get [EnabledSymbol]() {
      return enabled && !disposed;
    },
    get disposed() {
      return disposed;
    },
    get [DisposedSymbol]() {
      return disposed;
    },
    get canceled() {
      return !enabled;
    },
    get [CanceledSymbol]() {
      return !enabled;
    },
    get cancelReason() {
      return cancelReason;
    },
    get [CancelReasonSymbol]() {
      return cancelReason;
    },
    [Symbol.asyncDispose]: run,
  };
};

/**
 * Creates a sync disposable with cancellation, resume, and double-dispose protection.
 *
 * @example
 * ```ts
 * using cleanup = deferSync(() => {
 *   console.log("cleanup");
 * });
 * ```
 */
export const deferSync = (fn: () => void, options?: DeferOptions): DeferredSync => {
  let enabled = true;
  let disposed = false;
  let cancelReason: unknown;

  const cancel = (reason?: unknown) => {
    enabled = false;
    cancelReason = reason;
    options?.onCancel?.(reason);
  };

  const resume = () => {
    if (!disposed) {
      enabled = true;
      cancelReason = undefined;
    }
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      cancel(options.signal.reason);
    } else {
      options.signal.addEventListener("abort", () => cancel(options.signal!.reason), {
        once: true,
      });
    }
  }

  const run = () => {
    if (!enabled || disposed) return;
    disposed = true;
    fn();
    options?.onDispose?.();
  };

  return {
    cancel,
    resume,
    dispose: run,
    get enabled() {
      return enabled && !disposed;
    },
    get [EnabledSymbol]() {
      return enabled && !disposed;
    },
    get disposed() {
      return disposed;
    },
    get [DisposedSymbol]() {
      return disposed;
    },
    get canceled() {
      return !enabled;
    },
    get [CanceledSymbol]() {
      return !enabled;
    },
    get cancelReason() {
      return cancelReason;
    },
    get [CancelReasonSymbol]() {
      return cancelReason;
    },
    [Symbol.dispose]: run,
  };
};
