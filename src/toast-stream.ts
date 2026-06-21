import type { ReactNode } from "react";

import {
  AsyncChannel,
  isAsyncGenerator,
  isAsyncIterable,
  isGenerator,
  isIterable,
  resolveStreamSource,
  type StreamSource,
  toAsyncIterable,
  wait,
} from "./index.ts";
import { type ExternalToast, toast } from "sonner";

// Types matching Sonner's patterns
type StreamExternalToast = Omit<ExternalToast, "description">;

interface StreamExtendedResult extends ExternalToast {
  message: ReactNode;
}

/** Result can be string, ReactNode, or callback returning either (sync or async) */
type StreamResultT<TData = unknown> =
  | string
  | ReactNode
  | ((data: TData) => ReactNode | string | Promise<ReactNode | string>);

/** Extended result includes full toast options */
type StreamExtendedResultT<TData = unknown> =
  | StreamExtendedResult
  | ((data: TData) => StreamExtendedResult | Promise<StreamExtendedResult>);

/** Error result - callback receives error first, then partial data */
type StreamErrorResultT<TYield> =
  | string
  | ReactNode
  | ((
      error: unknown,
      partial: ErrorPartialData<TYield>,
    ) => ReactNode | string | Promise<ReactNode | string>);

/** Extended error result with toast options */
type StreamExtendedErrorResultT<TYield> =
  | StreamExtendedResult
  | ((
      error: unknown,
      partial: ErrorPartialData<TYield>,
    ) => StreamExtendedResult | Promise<StreamExtendedResult>);

/** Streaming progress data passed to callbacks */
type StreamingData<T> = {
  count: number;
  latest: T;
  /** All items received so far (including latest) */
  items: T[];
};

/** Success data passed to callbacks - includes return value if generator has one */
type SuccessData<TYield, TReturn = void> = {
  count: number;
  items: TYield[];
  /** The return value from the generator (if any) */
  returnValue: TReturn;
};

/** Partial data available when an error occurs */
type ErrorPartialData<TYield> = {
  /** Number of items received before error */
  count: number;
  /** Items received before error */
  items: TYield[];
};

/** Result of consuming a stream */
type StreamResult<TYield, TReturn> = {
  items: TYield[];
  returnValue: TReturn;
};

/** Internal result from consumeStream - includes partial data on error */
type ConsumeResult<TYield, TReturn> =
  | { ok: true; items: TYield[]; returnValue: TReturn }
  | { ok: false; items: TYield[]; error: unknown };

/** Granular delay configuration */
type DelayConfig = {
  /** Delay between items in ms */
  items?: number;
  /** Delay after loading, before first item */
  first?: number;
  /** Delay before showing success/error */
  result?: number;
};

/** Loading result - no data, just static or callback */
type LoadingResultT = string | ReactNode | (() => ReactNode | string | Promise<ReactNode | string>);

/** Extended loading result with toast options */
interface LoadingExtendedResult extends ExternalToast {
  message: ReactNode;
}

type LoadingExtendedResultT =
  | LoadingExtendedResult
  | (() => LoadingExtendedResult | Promise<LoadingExtendedResult>);

/** Options matching Sonner's PromiseData pattern */
type ToastStreamData<TYield = unknown, TReturn = void> = StreamExternalToast & {
  /**
   * Message shown while waiting for first item.
   * Supports string, ReactNode, callback, or extended result with toast options.
   */
  loading?: LoadingResultT | LoadingExtendedResultT;
  /** Message shown while streaming - updates on each item */
  streaming?: StreamResultT<StreamingData<TYield>> | StreamExtendedResultT<StreamingData<TYield>>;
  /** Message shown on successful completion */
  success?:
    | StreamResultT<SuccessData<TYield, TReturn>>
    | StreamExtendedResultT<SuccessData<TYield, TReturn>>;
  /** Message shown on error - callback receives (error, { count, items }) */
  error?: StreamErrorResultT<TYield> | StreamExtendedErrorResultT<TYield>;
  /** Called when stream ends (success or error) */
  finally?: () => void | Promise<void>;
  /** Called for each item received */
  onItem?: (item: TYield, count: number) => void;
  /**
   * Artificial delay for visualizing sync streams.
   * - `number`: applies to all phases (first, items, result)
   * - `object`: granular control over individual phases
   *
   * @example
   * // Simple: 500ms for all phases (first, between items, before result)
   * delay: 500
   *
   * @example
   * // Granular: different delays for different phases
   * delay: { first: 500, items: 300, result: 200 }
   */
  delay?: number | DelayConfig;
};

/** Resolve a result that can be string, ReactNode, or callback */
async function resolveResult<TData>(
  result: StreamResultT<TData> | StreamExtendedResultT<TData> | undefined,
  data: TData,
  fallback: string,
): Promise<{ message: ReactNode; options?: ExternalToast }> {
  if (result === undefined) {
    return { message: fallback };
  }

  if (typeof result === "function") {
    const resolved = await result(data);
    if (typeof resolved === "object" && resolved !== null && "message" in resolved) {
      const { message, ...options } = resolved as StreamExtendedResult;
      return { message, options };
    }
    return { message: resolved as ReactNode };
  }

  if (typeof result === "object" && result !== null && "message" in result) {
    const { message, ...options } = result as StreamExtendedResult;
    return { message, options };
  }

  return { message: result };
}

/** Resolve an error result that receives (error, partialData) */
async function resolveErrorResult<TYield>(
  result: StreamErrorResultT<TYield> | StreamExtendedErrorResultT<TYield> | undefined,
  error: unknown,
  partial: ErrorPartialData<TYield>,
  fallback: string,
): Promise<{ message: ReactNode; options?: ExternalToast }> {
  if (result === undefined) {
    return { message: fallback };
  }

  if (typeof result === "function") {
    const resolved = await result(error, partial);
    if (typeof resolved === "object" && resolved !== null && "message" in resolved) {
      const { message, ...options } = resolved as StreamExtendedResult;
      return { message, options };
    }
    return { message: resolved as ReactNode };
  }

  if (typeof result === "object" && result !== null && "message" in result) {
    const { message, ...options } = result as StreamExtendedResult;
    return { message, options };
  }

  return { message: result };
}

/** Resolve loading result - no data passed to callback */
async function resolveLoading(
  result: LoadingResultT | LoadingExtendedResultT | undefined,
  fallback: string,
): Promise<{ message: ReactNode; options?: ExternalToast }> {
  if (result === undefined) {
    return { message: fallback };
  }

  if (typeof result === "function") {
    const resolved = await result();
    if (typeof resolved === "object" && resolved !== null && "message" in resolved) {
      const { message, ...options } = resolved as LoadingExtendedResult;
      return { message, options };
    }
    return { message: resolved as ReactNode };
  }

  if (typeof result === "object" && result !== null && "message" in result) {
    const { message, ...options } = result as LoadingExtendedResult;
    return { message, options };
  }

  return { message: result };
}

/** Normalize delay option to full DelayConfig */
function normalizeDelay(delay: number | DelayConfig | undefined): DelayConfig {
  if (delay === undefined) {
    return {};
  }
  if (typeof delay === "number") {
    // Simple number applies to all phases: first, items, and result
    return { first: delay, items: delay, result: delay };
  }
  return delay;
}

/** Options for consumeStream */
type ConsumeStreamOptions<TYield, TReturn> = {
  source: StreamSource<TYield>;
  toastId: string | number;
  streaming: ToastStreamData<TYield, TReturn>["streaming"];
  onItem: ToastStreamData<TYield, TReturn>["onItem"];
  delayConfig: DelayConfig;
};

/** Core streaming logic - consumes source and updates toast, captures return value */
async function consumeStream<TYield, TReturn>(
  options: ConsumeStreamOptions<TYield, TReturn>,
): Promise<ConsumeResult<TYield, TReturn>> {
  const { source: sourceOrFactory, toastId, streaming, onItem, delayConfig } = options;
  // Resolve factory function if needed
  const source = resolveStreamSource(sourceOrFactory);

  const items: TYield[] = [];
  let count = 0;
  let isFirst = true;

  const updateToast = async (item: TYield) => {
    // Delay before first item (after loading)
    if (isFirst && delayConfig.first) {
      await wait(delayConfig.first);
      isFirst = false;
    } else if (!isFirst && delayConfig.items) {
      // Delay between items (not before first)
      await wait(delayConfig.items);
    } else {
      isFirst = false;
    }

    count += 1;
    items.push(item);
    onItem?.(item, count);

    const streamingData: StreamingData<TYield> = {
      count,
      latest: item,
      items: [...items],
    };
    const { message: streamingMsg, options: streamingOptions } = await resolveResult(
      streaming,
      streamingData,
      `Streaming... (${count} items)`,
    );
    toast.loading(streamingMsg, { id: toastId, ...streamingOptions });
  };

  try {
    // Handle sync Generator specially to capture return value
    if (isGenerator<TYield, TReturn>(source)) {
      let result = source.next();
      while (!result.done) {
        await updateToast(result.value);
        result = source.next();
      }
      return { ok: true, items, returnValue: result.value };
    }

    // Handle AsyncGenerator specially to capture return value
    if (isAsyncGenerator<TYield, TReturn>(source)) {
      let result = await source.next();
      while (!result.done) {
        await updateToast(result.value);
        result = await source.next();
      }
      return { ok: true, items, returnValue: result.value };
    }

    // Handle AsyncChannel specially to capture return value
    if (source instanceof AsyncChannel) {
      const iterator = source[Symbol.asyncIterator]();
      let result = await iterator.next();
      while (!result.done) {
        await updateToast(result.value);
        result = await iterator.next();
      }
      return { ok: true, items, returnValue: result.value };
    }

    // For plain iterables/iterators, convert and iterate (no return value)
    const iterable =
      isAsyncIterable(source) || isIterable(source)
        ? toAsyncIterable(source)
        : toAsyncIterable(source as AsyncIterator<TYield>);

    for await (const item of iterable) {
      await updateToast(item);
    }

    return { ok: true, items, returnValue: undefined as TReturn };
  } catch (error) {
    return { ok: false, items, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// toastStream overloads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Like `toast.promise` but for iterables/generators/streams.
 *
 * Blocking/awaitable API: waits until the stream completes and resolves to
 * `{ items, returnValue }`. Use this when the caller should wait for all
 * streamed values before continuing.
 *
 * Handles: loading → streaming → success/error.
 *
 * Supports sync and async sources. Captures generator return values.
 * Accepts either an instance or a factory function.
 *
 * @example Async generator with progress and return value
 * ```ts
 * import { toastStream } from "@xtandard/lib/sonner";
 *
 * async function* importUsers() {
 *   yield { id: 1, name: "Ada" };
 *   yield { id: 2, name: "Grace" };
 *   return { imported: 2 };
 * }
 *
 * const { items, returnValue } = await toastStream(importUsers, {
 *   loading: "Importing users...",
 *   streaming: ({ count, latest }) => `Imported ${count}: ${latest.name}`,
 *   success: ({ count, returnValue }) =>
 *     `Imported ${count} users (${returnValue.imported} confirmed)`,
 *   error: (error, partial) =>
 *     `Import failed after ${partial.count} users: ${String(error)}`,
 * });
 * ```
 *
 * @example Sync iterable with artificial delay
 * ```ts
 * const result = await toastStream(["parse", "validate", "save"], {
 *   loading: "Starting...",
 *   streaming: ({ latest }) => `Running ${latest}`,
 *   success: ({ count }) => `Completed ${count} steps`,
 *   delay: { first: 300, items: 200, result: 150 },
 * });
 * ```
 */
export function toastStream<TYield, TReturn>(
  source:
    | AsyncGenerator<TYield, TReturn, unknown>
    | (() => AsyncGenerator<TYield, TReturn, unknown>),
  data?: ToastStreamData<TYield, TReturn>,
): Promise<StreamResult<TYield, TReturn>>;

/** Sync Generator with return value */
export function toastStream<TYield, TReturn>(
  source: Generator<TYield, TReturn, unknown> | (() => Generator<TYield, TReturn, unknown>),
  data?: ToastStreamData<TYield, TReturn>,
): Promise<StreamResult<TYield, TReturn>>;

/** AsyncChannel with return type - must come before AsyncIterable overload */
export function toastStream<TYield, TReturn>(
  source: AsyncChannel<TYield, TReturn> | (() => AsyncChannel<TYield, TReturn>),
  data?: ToastStreamData<TYield, TReturn>,
): Promise<StreamResult<TYield, TReturn>>;

/** AsyncIterable (no return value) */
export function toastStream<TYield>(
  source: AsyncIterable<TYield> | (() => AsyncIterable<TYield>),
  data?: ToastStreamData<TYield, void>,
): Promise<StreamResult<TYield, void>>;

/** AsyncIterator (no return value) */
export function toastStream<TYield>(
  source: AsyncIterator<TYield> | (() => AsyncIterator<TYield>),
  data?: ToastStreamData<TYield, void>,
): Promise<StreamResult<TYield, void>>;

/** Sync Iterable (no return value) */
export function toastStream<TYield>(
  source: Iterable<TYield> | (() => Iterable<TYield>),
  data?: ToastStreamData<TYield, void>,
): Promise<StreamResult<TYield, void>>;

/** Sync Iterator (no return value) */
export function toastStream<TYield>(
  source: Iterator<TYield> | (() => Iterator<TYield>),
  data?: ToastStreamData<TYield, void>,
): Promise<StreamResult<TYield, void>>;

// Implementation
export async function toastStream<TYield, TReturn = void>(
  source: StreamSource<TYield>,
  data: ToastStreamData<TYield, TReturn> = {},
): Promise<StreamResult<TYield, TReturn>> {
  const {
    loading,
    streaming,
    success,
    error,
    finally: onFinally,
    onItem,
    delay,
    ...toastOptions
  } = data;

  const delayConfig = normalizeDelay(delay);
  const { message: loadingMsg, options: loadingOptions } = await resolveLoading(
    loading,
    "Processing...",
  );
  const toastId = toast.loading(loadingMsg, {
    ...toastOptions,
    ...loadingOptions,
  });

  const result = await consumeStream<TYield, TReturn>({
    source,
    toastId,
    streaming,
    onItem,
    delayConfig,
  });

  await onFinally?.();

  // Delay before showing result
  if (delayConfig.result) {
    await wait(delayConfig.result);
  }

  if (!result.ok) {
    const partial: ErrorPartialData<TYield> = {
      count: result.items.length,
      items: result.items,
    };
    const { message: errorMsg, options: errorOptions } = await resolveErrorResult(
      error,
      result.error,
      partial,
      "Stream failed",
    );
    toast.error(errorMsg, { id: toastId, ...errorOptions });
    throw result.error;
  }

  const successData: SuccessData<TYield, TReturn> = {
    count: result.items.length,
    items: result.items,
    returnValue: result.returnValue,
  };
  const { message: successMsg, options: successOptions } = await resolveResult(
    success,
    successData,
    `Complete! ${result.items.length} items`,
  );

  toast.success(successMsg, { id: toastId, ...successOptions });
  return { items: result.items, returnValue: result.returnValue };
}

// ─────────────────────────────────────────────────────────────────────────────
// toastStreamAsync overloads
// ─────────────────────────────────────────────────────────────────────────────

/** Return type matching toast.promise's unwrap pattern */
type ToastStreamReturn<TYield, TReturn> = (string | number) & {
  unwrap: () => Promise<StreamResult<TYield, TReturn>>;
};

/**
 * Non-blocking version that returns immediately like `toast.promise`.
 * Returns the toast ID with an `unwrap()` method to await the result later.
 * Accepts either an instance or a factory function.
 *
 * Use this when the UI should continue immediately while the toast tracks the
 * stream in the background.
 *
 * @example
 * ```ts
 * import { toastStreamAsync } from "@xtandard/lib/sonner";
 *
 * const toastId = toastStreamAsync(importUsers, {
 *   loading: "Importing users...",
 *   streaming: ({ count }) => `Imported ${count}`,
 *   success: ({ count }) => `Imported ${count} users`,
 * });
 *
 * // The caller continues immediately; await only if/when the result matters.
 * const { items, returnValue } = await toastId.unwrap();
 * ```
 *
 * @example Fire-and-track with error handling
 * ```ts
 * const toastId = toastStreamAsync(uploadFiles(files), {
 *   loading: "Uploading...",
 *   streaming: ({ count }) => `${count} files uploaded`,
 *   error: (error, partial) =>
 *     `Upload failed after ${partial.count} files: ${String(error)}`,
 * });
 *
 * toastId.unwrap().catch((error) => {
 *   reportError(error);
 * });
 * ```
 */
export function toastStreamAsync<TYield, TReturn>(
  source:
    | AsyncGenerator<TYield, TReturn, unknown>
    | (() => AsyncGenerator<TYield, TReturn, unknown>),
  data?: ToastStreamData<TYield, TReturn>,
): ToastStreamReturn<TYield, TReturn>;

/** Sync Generator with return value */
export function toastStreamAsync<TYield, TReturn>(
  source: Generator<TYield, TReturn, unknown> | (() => Generator<TYield, TReturn, unknown>),
  data?: ToastStreamData<TYield, TReturn>,
): ToastStreamReturn<TYield, TReturn>;

/** AsyncChannel with return type */
export function toastStreamAsync<TYield, TReturn>(
  source: AsyncChannel<TYield, TReturn> | (() => AsyncChannel<TYield, TReturn>),
  data?: ToastStreamData<TYield, TReturn>,
): ToastStreamReturn<TYield, TReturn>;

/** AsyncIterable - excludes AsyncChannel which has its own overload */
export function toastStreamAsync<TYield>(
  source:
    | Exclude<AsyncIterable<TYield>, AsyncChannel<TYield, unknown>>
    | (() => Exclude<AsyncIterable<TYield>, AsyncChannel<TYield, unknown>>),
  data?: ToastStreamData<TYield, void>,
): ToastStreamReturn<TYield, void>;

/** AsyncIterator */
export function toastStreamAsync<TYield>(
  source: AsyncIterator<TYield> | (() => AsyncIterator<TYield>),
  data?: ToastStreamData<TYield, void>,
): ToastStreamReturn<TYield, void>;

/** Sync Iterable */
export function toastStreamAsync<TYield>(
  source: Iterable<TYield> | (() => Iterable<TYield>),
  data?: ToastStreamData<TYield, void>,
): ToastStreamReturn<TYield, void>;

/** Sync Iterator */
export function toastStreamAsync<TYield>(
  source: Iterator<TYield> | (() => Iterator<TYield>),
  data?: ToastStreamData<TYield, void>,
): ToastStreamReturn<TYield, void>;

// Implementation
export function toastStreamAsync<TYield, TReturn = void>(
  source: StreamSource<TYield>,
  data: ToastStreamData<TYield, TReturn> = {},
): ToastStreamReturn<TYield, TReturn> {
  const { loading, delay, ...rest } = data;

  const delayConfig = normalizeDelay(delay);
  // For non-blocking version, show simple loading immediately
  // Callbacks and extended results are resolved inside the promise
  const needsAsyncResolve =
    typeof loading === "function" ||
    (typeof loading === "object" && loading !== null && "message" in loading);
  const initialLoadingMsg = needsAsyncResolve
    ? "Processing..."
    : ((loading as ReactNode) ?? "Processing...");
  const toastId = toast.loading(initialLoadingMsg);

  const promise = (async () => {
    const { streaming, success, error, finally: onFinally, onItem, ...toastOptions } = rest;

    // If loading needs async resolution (callback or extended result), resolve and update
    if (needsAsyncResolve) {
      const { message: loadingMsg, options: loadingOptions } = await resolveLoading(
        loading,
        "Processing...",
      );
      toast.loading(loadingMsg, { id: toastId, ...loadingOptions });
    }

    const result = await consumeStream<TYield, TReturn>({
      source,
      toastId,
      streaming,
      onItem,
      delayConfig,
    });

    await onFinally?.();

    // Delay before showing result
    if (delayConfig.result) {
      await wait(delayConfig.result);
    }

    if (!result.ok) {
      const partial: ErrorPartialData<TYield> = {
        count: result.items.length,
        items: result.items,
      };
      const { message: errorMsg, options: errorOptions } = await resolveErrorResult(
        error,
        result.error,
        partial,
        "Stream failed",
      );
      toast.error(errorMsg, { id: toastId, ...toastOptions, ...errorOptions });
      throw result.error;
    }

    const successData: SuccessData<TYield, TReturn> = {
      count: result.items.length,
      items: result.items,
      returnValue: result.returnValue,
    };
    const { message: successMsg, options: successOptions } = await resolveResult(
      success,
      successData,
      `Complete! ${result.items.length} items`,
    );

    toast.success(successMsg, {
      id: toastId,
      ...toastOptions,
      ...successOptions,
    });
    return { items: result.items, returnValue: result.returnValue };
  })();

  // Match toast.promise's return signature
  const res = toastId as ToastStreamReturn<TYield, TReturn>;
  res.unwrap = () => promise;
  return res;
}
