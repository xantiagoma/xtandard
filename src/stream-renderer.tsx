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
import {
  experimental_streamedQuery as streamedQuery,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Render prop: can be ReactNode or function returning ReactNode */
type RenderProp<TData> = ReactNode | ((data: TData) => ReactNode);

/** Render prop without data (for loading) */
type RenderPropNoData = ReactNode | (() => ReactNode);

/** Stream state with accumulated items */
export type StreamState<TYield, TReturn = void> = {
  items: TYield[];
  count: number;
  latest: TYield | null;
  returnValue: TReturn | undefined;
  status: "streaming" | "complete";
};

/** Granular delay configuration */
export type DelayConfig = {
  items?: number;
  first?: number;
  result?: number;
};

/** Streaming data passed to streaming render prop */
export type StreamingData<TYield> = {
  count: number;
  latest: TYield;
  items: TYield[];
};

/** Success data passed to success render prop */
export type SuccessData<TYield, TReturn> = {
  count: number;
  items: TYield[];
  returnValue: TReturn | undefined;
};

/** Error data passed to error render prop */
export type ErrorData<TYield> = {
  error: Error;
  count: number;
  items: TYield[];
};

/** Data passed to onItem callback */
export type OnItemData<TYield> = {
  item: TYield;
  count: number;
  items: TYield[];
};

/** Data passed to onSuccess callback */
export type OnSuccessData<TYield, TReturn = void> = {
  count: number;
  items: TYield[];
  returnValue: TReturn | undefined;
};

/** Data passed to onError callback */
export type OnErrorData<TYield> = {
  error: Error;
  count: number;
  items: TYield[];
};

/** Children render prop data - includes status and all relevant data */
export type ChildrenData<TYield, TReturn = void> =
  | {
      status: "loading";
      count: 0;
      items: [];
      latest: null;
      returnValue: undefined;
      error: null;
    }
  | {
      status: "streaming";
      count: number;
      items: TYield[];
      latest: TYield;
      returnValue: undefined;
      error: null;
    }
  | {
      status: "success";
      count: number;
      items: TYield[];
      latest: TYield | null;
      returnValue: TReturn | undefined;
      error: null;
    }
  | {
      status: "error";
      count: number;
      items: TYield[];
      latest: TYield | null;
      returnValue: undefined;
      error: Error;
    };

/** Base props for StreamRenderer */
export type StreamRendererBaseProps<TYield, TReturn = void> = {
  /** The stream source - can be instance or factory */
  source: StreamSource<TYield> | null | undefined;

  /** Unique key for the query cache */
  queryKey?: unknown[];
  /** Delay configuration for visualizing sync streams */
  delay?: number | DelayConfig;
  /** Called for each item received */
  onItem?: (data: OnItemData<TYield>) => void;
  /** Called when stream completes successfully */
  onSuccess?: (data: OnSuccessData<TYield, TReturn>) => void;
  /** Called when stream errors */
  onError?: (data: OnErrorData<TYield>) => void;
  /** Whether to start streaming immediately (default: true) */
  enabled?: boolean;
  /**
   * Retry configuration on error (default: false = no retries)
   * - `false`: no retries
   * - `true`: use TanStack Query default (3 retries)
   * - `number`: retry that many times
   * - `(data) => boolean`: custom retry logic with access to partial data
   */
  retry?: boolean | number | ((data: RetryData<TYield>) => boolean);
};

/** Props for StreamRenderer - supports all accumulation modes */
export type StreamRendererProps<TYield, TReturn = void> = StreamRendererBaseProps<
  TYield,
  TReturn
> & {
  /**
   * Accumulation mode (mutually exclusive with maxItems)
   * - `"accumulate"` (default): keep all items
   * - `"latest"`: only keep the most recent item
   */
  mode?: StreamMode;
  /** Keep only the last N items (mutually exclusive with mode) */
  maxItems?: number;
  /** Render while loading - ReactNode or () => ReactNode */
  loading?: RenderPropNoData;
  /** Render while streaming - ReactNode or (data) => ReactNode */
  streaming?: RenderProp<StreamingData<TYield>>;
  /** Render on success - ReactNode or (data) => ReactNode */
  success?: RenderProp<SuccessData<TYield, TReturn>>;
  /** Render on error - ReactNode or (data) => ReactNode */
  error?: RenderProp<ErrorData<TYield>>;
  /** Fallback/universal render prop - ReactNode or (data) => ReactNode */
  children?: RenderProp<ChildrenData<TYield, TReturn>>;
};

/** Data passed to retry callback */
export type RetryData<TYield> = {
  /** Number of times the query has failed (starts at 0) */
  failureCount: number;
  /** The error that caused the failure */
  error: Error;
  /** Items collected before the error */
  items: TYield[];
  /** Number of items collected before the error */
  count: number;
  /** Last item received before the error (null if none) */
  latest: TYield | null;
};

/**
 * Accumulation mode for stream items.
 * - `"accumulate"` (default): keep all items in memory
 * - `"latest"`: only keep the most recent item
 */
export type StreamMode = "accumulate" | "latest";

/**
 * Custom reducer for stream state.
 * Receives current state and new item, returns new state.
 */
export type StreamReducer<TYield, TState> = (state: TState, item: TYield, count: number) => TState;

/** Base options shared by all useStream configurations */
type UseStreamBaseOptions<TYield, TReturn = void> = {
  /** The stream source - can be instance or factory */
  source: StreamSource<TYield> | null | undefined;
  /** Unique key for the query cache */
  queryKey?: unknown[];
  /** Delay configuration for visualizing sync streams */
  delay?: number | DelayConfig;
  /** Called for each item received */
  onItem?: (data: OnItemData<TYield>) => void;
  /** Called when stream completes successfully */
  onSuccess?: (data: OnSuccessData<TYield, TReturn>) => void;
  /** Called when stream errors */
  onError?: (data: OnErrorData<TYield>) => void;
  /** Whether to start streaming immediately (default: true) */
  enabled?: boolean;
  /**
   * Retry configuration on error (default: false = no retries)
   * - `false`: no retries
   * - `true`: use TanStack Query default (3 retries)
   * - `number`: retry that many times
   * - `(data) => boolean`: custom retry logic with access to partial data
   */
  retry?: boolean | number | ((data: RetryData<TYield>) => boolean);
};

/** Options with default accumulation (all items) */
type UseStreamAccumulateOptions<TYield, TReturn = void> = UseStreamBaseOptions<TYield, TReturn> & {
  mode?: "accumulate";
  maxItems?: never;
  reducer?: never;
};

/** Options with "latest" mode (only keep last item) */
type UseStreamLatestOptions<TYield, TReturn = void> = UseStreamBaseOptions<TYield, TReturn> & {
  mode: "latest";
  maxItems?: never;
  reducer?: never;
};

/** Options with maxItems (sliding window) */
type UseStreamMaxItemsOptions<TYield, TReturn = void> = UseStreamBaseOptions<TYield, TReturn> & {
  mode?: never;
  /** Keep only the last N items (sliding window) */
  maxItems: number;
  reducer?: never;
};

/** Options with custom reducer */
type UseStreamReducerOptions<TYield, TState, TReturn = void> = UseStreamBaseOptions<
  TYield,
  TReturn
> & {
  mode?: never;
  maxItems?: never;
  /** Custom reducer function for complete control over state */
  reducer: StreamReducer<TYield, TState>;
  /** Initial state for custom reducer */
  initialState: TState;
};

/** Props for useStream hook - mutually exclusive accumulation options */
export type UseStreamOptions<TYield, TReturn = void, TState = unknown> =
  | UseStreamAccumulateOptions<TYield, TReturn>
  | UseStreamLatestOptions<TYield, TReturn>
  | UseStreamMaxItemsOptions<TYield, TReturn>
  | UseStreamReducerOptions<TYield, TState, TReturn>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeDelay(delay: number | DelayConfig | undefined): DelayConfig {
  if (delay === undefined) {
    return {};
  }
  if (typeof delay === "number") {
    return { first: delay, items: delay, result: delay };
  }
  return delay;
}

/** Resolve a render prop (ReactNode or function) */
function resolveRenderProp<TData>(
  prop: RenderProp<TData> | undefined,
  data: TData,
  fallback: ReactNode,
): ReactNode {
  if (prop === undefined) {
    return fallback;
  }
  if (typeof prop === "function") {
    return prop(data);
  }
  return prop;
}

/** Resolve a render prop without data (for loading) */
function resolveRenderPropNoData(
  prop: RenderPropNoData | undefined,
  fallback: ReactNode,
): ReactNode {
  if (prop === undefined) {
    return fallback;
  }
  if (typeof prop === "function") {
    return prop();
  }
  return prop;
}

// ─────────────────────────────────────────────────────────────────────────────
// useStream Hook
// ─────────────────────────────────────────────────────────────────────────────

/** Result type for standard useStream (accumulate, latest, maxItems modes) */
export type UseStreamResult<TYield, TReturn = void> = {
  query: UseQueryResult<StreamState<TYield, TReturn>, Error>;
  /** Items received (all, last N, or just latest depending on mode) */
  items: TYield[];
  /** Total number of items received (even if not all kept in memory) */
  count: number;
  /** Most recent item */
  latest: TYield | null;
  /** Return value from generator (if complete) */
  returnValue: TReturn | undefined;
  /** Restart the stream */
  refetch: () => void;
  // Status flags
  isLoading: boolean;
  isStreaming: boolean;
  isSuccess: boolean;
  isError: boolean;
};

/** Result type for useStream with custom reducer */
export type UseStreamReducerResult<_TYield, TState> = {
  query: UseQueryResult<{ state: TState; count: number; status: "streaming" | "complete" }, Error>;
  /** Custom state from reducer */
  state: TState;
  /** Total number of items received */
  count: number;
  /** Restart the stream */
  refetch: () => void;
  // Status flags
  isLoading: boolean;
  isStreaming: boolean;
  isSuccess: boolean;
  isError: boolean;
};

/**
 * Hook for consuming streams using TanStack Query's streamedQuery.
 *
 * @example
 * ```tsx
 * // Default: accumulate all items
 * const { items, isStreaming, count } = useStream({
 *   source: fetchItems,
 *   queryKey: ['my-stream'],
 * });
 *
 * // Latest only: keep just the most recent item
 * const { items, latest } = useStream({
 *   source: sseEvents,
 *   mode: "latest",
 * });
 *
 * // Sliding window: keep last N items
 * const { items } = useStream({
 *   source: logStream,
 *   maxItems: 100,
 * });
 *
 * // Custom reducer: full control over state
 * const { state } = useStream({
 *   source: events,
 *   reducer: (state, event) => ({ ...state, [event.id]: event }),
 *   initialState: {},
 * });
 * ```
 */
// Overload: custom reducer
export function useStream<TYield, TState, TReturn = void>(
  options: UseStreamReducerOptions<TYield, TState, TReturn>,
): UseStreamReducerResult<TYield, TState>;

// Overload: standard modes (accumulate, latest, maxItems)
export function useStream<TYield, TReturn = void>(
  options:
    | UseStreamAccumulateOptions<TYield, TReturn>
    | UseStreamLatestOptions<TYield, TReturn>
    | UseStreamMaxItemsOptions<TYield, TReturn>,
): UseStreamResult<TYield, TReturn>;

// Implementation
export function useStream<TYield, TReturn = void, TState = unknown>(
  options: UseStreamOptions<TYield, TReturn, TState>,
): UseStreamResult<TYield, TReturn> | UseStreamReducerResult<TYield, TState> {
  const {
    source,
    queryKey,
    delay,
    onItem,
    onSuccess,
    onError,
    enabled = true,
    retry = false,
  } = options;

  // Extract mode options
  const mode = "mode" in options ? options.mode : undefined;
  const maxItems = "maxItems" in options ? options.maxItems : undefined;
  const customReducer = "reducer" in options ? options.reducer : undefined;
  const initialState = "initialState" in options ? options.initialState : undefined;

  const delayConfig = useMemo(() => normalizeDelay(delay), [delay]);

  // Track partial state for retry callback
  const partialStateRef = useRef<{
    items: TYield[];
    count: number;
    latest: TYield | null;
  }>({ items: [], count: 0, latest: null });

  // Create a stable query key
  const stableQueryKey = useMemo(() => queryKey ?? ["stream", source], [queryKey, source]);

  const query = useQuery({
    queryKey: stableQueryKey,
    enabled: enabled && source != null,
    queryFn: streamedQuery({
      async *streamFn() {
        // Reset partial state on new fetch
        partialStateRef.current = { items: [], count: 0, latest: null };

        const resolved = resolveStreamSource(source as StreamSource<TYield>);
        let isFirst = true;
        let itemCount = 0;

        const processDelay = async () => {
          if (isFirst && delayConfig.first) {
            await wait(delayConfig.first);
            isFirst = false;
          } else if (!isFirst && delayConfig.items) {
            await wait(delayConfig.items);
          } else {
            isFirst = false;
          }
        };

        const trackItem = (item: TYield) => {
          partialStateRef.current = {
            items: [...partialStateRef.current.items, item],
            count: partialStateRef.current.count + 1,
            latest: item,
          };
        };

        const emitItem = (item: TYield) => {
          onItem?.({
            item,
            count: partialStateRef.current.count,
            items: partialStateRef.current.items,
          });
        };

        // Handle sync Generator (captures return value)
        if (isGenerator<TYield, TReturn>(resolved)) {
          let result = resolved.next();
          while (!result.done) {
            await processDelay();
            itemCount += 1;
            trackItem(result.value);
            emitItem(result.value);
            yield {
              type: "item" as const,
              value: result.value,
              count: itemCount,
            };
            result = resolved.next();
          }
          if (delayConfig.result) {
            await wait(delayConfig.result);
          }
          yield { type: "return" as const, value: result.value };
          return;
        }

        // Handle AsyncGenerator (captures return value)
        if (isAsyncGenerator<TYield, TReturn>(resolved)) {
          let result = await resolved.next();
          while (!result.done) {
            await processDelay();
            itemCount += 1;
            trackItem(result.value);
            emitItem(result.value);
            yield {
              type: "item" as const,
              value: result.value,
              count: itemCount,
            };
            result = await resolved.next();
          }
          if (delayConfig.result) {
            await wait(delayConfig.result);
          }
          yield { type: "return" as const, value: result.value };
          return;
        }

        // Handle AsyncChannel (captures return value)
        if (resolved instanceof AsyncChannel) {
          const iterator = resolved[Symbol.asyncIterator]();
          let result = await iterator.next();
          while (!result.done) {
            await processDelay();
            itemCount += 1;
            trackItem(result.value);
            emitItem(result.value);
            yield {
              type: "item" as const,
              value: result.value,
              count: itemCount,
            };
            result = await iterator.next();
          }
          if (delayConfig.result) {
            await wait(delayConfig.result);
          }
          yield { type: "return" as const, value: result.value };
          return;
        }

        // Handle plain iterables/iterators (no return value)
        const iterable =
          isAsyncIterable(resolved) || isIterable(resolved)
            ? toAsyncIterable(resolved)
            : toAsyncIterable(resolved as AsyncIterator<TYield>);

        for await (const item of iterable) {
          await processDelay();
          itemCount += 1;
          trackItem(item);
          emitItem(item);
          yield { type: "item" as const, value: item, count: itemCount };
        }

        if (delayConfig.result) {
          await wait(delayConfig.result);
        }
        yield { type: "complete" as const };
      },

      reducer: (
        state:
          | StreamState<TYield, TReturn>
          | { state: TState; count: number; status: "streaming" | "complete" },
        chunk:
          | { type: "item"; value: TYield; count: number }
          | { type: "return"; value: TReturn }
          | { type: "complete" },
      ) => {
        // Custom reducer mode
        if (customReducer) {
          const s = state as {
            state: TState;
            count: number;
            status: "streaming" | "complete";
          };
          if (chunk.type === "item") {
            return {
              state: customReducer(s.state, chunk.value, chunk.count),
              count: chunk.count,
              status: "streaming" as const,
            };
          }
          return { ...s, status: "complete" as const };
        }

        // Standard modes
        const s = state as StreamState<TYield, TReturn>;
        if (chunk.type === "item") {
          let newItems: TYield[];
          if (mode === "latest") {
            // Only keep the latest item
            newItems = [chunk.value];
          } else if (maxItems !== undefined) {
            // Sliding window: keep last N items
            newItems = [...s.items, chunk.value].slice(-maxItems);
          } else {
            // Default: accumulate all
            newItems = [...s.items, chunk.value];
          }
          return {
            ...s,
            items: newItems,
            count: chunk.count,
            latest: chunk.value,
            status: "streaming" as const,
          };
        }
        if (chunk.type === "return") {
          return {
            ...s,
            returnValue: chunk.value,
            status: "complete" as const,
          };
        }
        // complete
        return { ...s, status: "complete" as const };
      },

      initialValue: customReducer
        ? {
            state: initialState as TState,
            count: 0,
            status: "streaming" as const,
          }
        : ({
            items: [] as TYield[],
            count: 0,
            latest: null,
            returnValue: undefined,
            status: "streaming" as const,
          } as StreamState<TYield, TReturn>),

      refetchMode: "reset",
    }),
    // Wrap our callback to include partial state data
    retry:
      typeof retry === "function"
        ? (failureCount: number, error: Error) =>
            retry({
              failureCount,
              error,
              ...partialStateRef.current,
            })
        : retry,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  // Track callback invocations to prevent duplicates
  const callbackFiredRef = useRef<"success" | "error" | null>(null);

  // Compute derived state for both paths
  const reducerData = customReducer
    ? ((query.data as
        | { state: TState; count: number; status: "streaming" | "complete" }
        | undefined) ?? {
        state: initialState as TState,
        count: 0,
        status: "streaming" as const,
      })
    : null;

  const standardData = customReducer
    ? null
    : ((query.data as StreamState<TYield, TReturn> | undefined) ?? {
        items: [] as TYield[],
        count: 0,
        latest: null,
        returnValue: undefined,
        status: "streaming" as const,
      });

  const isComplete = customReducer
    ? query.isSuccess && reducerData?.status === "complete"
    : query.isSuccess && standardData?.status === "complete";

  const isErrorState = query.isError;

  // Fire onSuccess/onError callbacks
  useEffect(() => {
    if (isComplete && callbackFiredRef.current !== "success") {
      callbackFiredRef.current = "success";
      if (standardData) {
        onSuccess?.({
          count: standardData.count,
          items: standardData.items,
          returnValue: standardData.returnValue,
        });
      } else if (reducerData) {
        // For reducer mode, we don't have items/returnValue in the same way
        // but we can still call onSuccess with partial data from ref
        onSuccess?.({
          count: reducerData.count,
          items: partialStateRef.current.items,
          returnValue: undefined as TReturn | undefined,
        });
      }
    }
    if (isErrorState && callbackFiredRef.current !== "error" && query.error) {
      callbackFiredRef.current = "error";
      onError?.({
        error: query.error,
        count: partialStateRef.current.count,
        items: partialStateRef.current.items,
      });
    }
  }, [isComplete, isErrorState, onSuccess, onError, standardData, reducerData, query.error]);

  // Reset callback tracking on refetch
  useEffect(() => {
    if (query.fetchStatus === "fetching" && callbackFiredRef.current !== null) {
      callbackFiredRef.current = null;
    }
  }, [query.fetchStatus]);

  // Handle custom reducer result
  if (customReducer && reducerData) {
    const isReducerLoading =
      query.fetchStatus === "fetching" && reducerData.count === 0 && !query.isError;
    const isReducerStreaming =
      query.fetchStatus === "fetching" &&
      reducerData.count > 0 &&
      reducerData.status === "streaming";

    return {
      query: query as UseQueryResult<
        { state: TState; count: number; status: "streaming" | "complete" },
        Error
      >,
      state: reducerData.state,
      count: reducerData.count,
      refetch: query.refetch,
      isLoading: isReducerLoading,
      isStreaming: isReducerStreaming,
      isSuccess: isComplete,
      isError: query.isError,
    } as UseStreamReducerResult<TYield, TState>;
  }

  // Standard result (standardData is guaranteed non-null after the reducer early return)
  const data = standardData ?? {
    items: [] as TYield[],
    count: 0,
    latest: null,
    returnValue: undefined as TReturn | undefined,
    status: "streaming" as const,
  };

  // isLoading: fetching but no data yet (not just isPending which is true when disabled)
  const isLoading = query.fetchStatus === "fetching" && data.count === 0 && !query.isError;
  const isStreaming =
    query.fetchStatus === "fetching" && data.count > 0 && data.status === "streaming";

  return {
    query: query as UseQueryResult<StreamState<TYield, TReturn>, Error>,
    items: data.items,
    count: data.count,
    latest: data.latest,
    returnValue: data.returnValue,
    refetch: query.refetch,
    isLoading,
    isStreaming,
    isSuccess: isComplete,
    isError: query.isError,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// StreamRenderer Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders different content based on stream state using TanStack Query.
 *
 * @example
 * ```tsx
 * <StreamRenderer
 *   source={fetchItems}
 *   queryKey={['items']}
 *   loading={() => <Spinner />}
 *   streaming={({ count, latest }) => <p>Received {count}: {latest.name}</p>}
 *   success={({ items }) => <List items={items} />}
 *   error={({ error }) => <Error message={error.message} />}
 * />
 * ```
 */
export function StreamRenderer<TYield, TReturn = void>({
  source,
  queryKey,
  delay,
  onItem,
  onSuccess,
  onError,
  loading,
  streaming,
  success,
  error,
  children,
  mode,
  maxItems,
}: StreamRendererProps<TYield, TReturn>) {
  // Build useStream options based on mode/maxItems
  const streamOptions = useMemo(() => {
    const base = { source, queryKey, delay, onItem, onSuccess, onError };
    if (maxItems !== undefined) {
      return { ...base, maxItems };
    }
    if (mode === "latest") {
      return { ...base, mode: "latest" as const };
    }
    return base;
  }, [source, queryKey, delay, onItem, onSuccess, onError, mode, maxItems]);

  const stream = useStream<TYield, TReturn>(streamOptions);

  // Build children data based on current status
  const getChildrenData = (): ChildrenData<TYield, TReturn> => {
    if (stream.isError && stream.query.error) {
      return {
        status: "error",
        count: stream.count,
        items: stream.items,
        latest: stream.latest,
        returnValue: undefined,
        error: stream.query.error,
      };
    }
    if (stream.isSuccess) {
      return {
        status: "success",
        count: stream.count,
        items: stream.items,
        latest: stream.latest,
        returnValue: stream.returnValue,
        error: null,
      };
    }
    if (stream.isStreaming && stream.latest !== null) {
      return {
        status: "streaming",
        count: stream.count,
        items: stream.items,
        latest: stream.latest,
        returnValue: undefined,
        error: null,
      };
    }
    // Loading state
    return {
      status: "loading",
      count: 0,
      items: [] as TYield[],
      latest: null,
      returnValue: undefined,
      error: null,
    } as ChildrenData<TYield, TReturn>;
  };

  const childrenData = getChildrenData();
  const fallback = resolveRenderProp(children, childrenData, null);

  // Loading (before any data)
  if (stream.isLoading) {
    return resolveRenderPropNoData(loading, fallback);
  }

  // Error
  if (stream.isError && stream.query.error) {
    return resolveRenderProp(
      error,
      {
        error: stream.query.error,
        count: stream.count,
        items: stream.items,
      },
      fallback,
    );
  }

  // Success (stream complete)
  if (stream.isSuccess) {
    return resolveRenderProp(
      success,
      {
        count: stream.count,
        items: stream.items,
        returnValue: stream.returnValue,
      },
      fallback,
    );
  }

  // Streaming
  if (stream.isStreaming && stream.latest !== null) {
    return resolveRenderProp(
      streaming,
      {
        count: stream.count,
        latest: stream.latest,
        items: stream.items,
      },
      fallback,
    );
  }

  // Fallback (initial state before streaming starts)
  return resolveRenderPropNoData(loading, fallback);
}
