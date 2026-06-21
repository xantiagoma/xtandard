/**
 * Client entrypoint: framework-free parsers/helpers (re-exported from
 * `./server.ts`) + the React hooks + the TanStack Router adapter.
 *
 * The framework-free subset is also available without React at
 * `@xtandard/lib/tanstack/server`; the testing adapter at
 * `@xtandard/lib/tanstack/testing`; temporal parsers at
 * `@xtandard/lib/tanstack/temporal`; the Rison codec at
 * `@xtandard/lib/tanstack/rison`.
 */

export * from "./server.ts";

export { useQueryState, type Setter } from "./react/use-query-state.ts";
export {
  useQueryStates,
  type SetValues,
  type UseQueryStatesOptions,
} from "./react/use-query-states.ts";

export { useUrlSearchString } from "./react/use-url-search-string.ts";

export { type AdapterValue, QueryStateAdapterContext } from "./react/context.ts";

export {
  NuqsAdapter,
  TanStackQueryStateAdapter,
  type TanStackQueryStateAdapterProps,
} from "./adapters/tanstack-router.tsx";
