/**
 * React hooks and components: `useStream`/`StreamRenderer`, `Providers`, `useDynamicRefs`, `usePreventAutoFocus` (peers `react`, `@tanstack/react-query`).
 *
 * Import from `@xtandard/lib/react`.
 *
 * @module react
 */

export { useStream, StreamRenderer } from "./stream-renderer.tsx";
export { Providers, provider } from "./providers.tsx";
export type { AnyProps, ProviderSpec, ProvidersProps } from "./providers.tsx";
export { usePreventAutoFocus } from "./use-prevent-auto-focus.ts";
export { useDynamicRefs } from "./use-dynamic-refs.ts";
export type { DynamicRefGetter, UseDynamicRefsOptions, RefMap } from "./use-dynamic-refs.ts";
export type {
  StreamState,
  DelayConfig,
  StreamingData,
  SuccessData,
  ErrorData,
  OnItemData,
  OnSuccessData,
  OnErrorData,
  ChildrenData,
  StreamRendererProps,
  StreamRendererBaseProps,
  RetryData,
  StreamMode,
  StreamReducer,
  UseStreamOptions,
  UseStreamBaseOptions,
  UseStreamAccumulateOptions,
  UseStreamLatestOptions,
  UseStreamMaxItemsOptions,
  UseStreamReducerOptions,
  RenderProp,
  RenderPropNoData,
  StreamSourceWithReturn,
  UseStreamSource,
  UseStreamResult,
  UseStreamReducerResult,
} from "./stream-renderer.tsx";
