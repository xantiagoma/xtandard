import { type ReactNode, useEffect, useMemo } from "react";

import type { QueryStateOptions, ResolvedOptions } from "../core/options.ts";

import { createQueryStateStore } from "../core/store.ts";
import { type AdapterValue, QueryStateAdapterContext } from "../react/context.ts";

export type UrlUpdateEvent = {
  queryString: string;
  searchParams: URLSearchParams;
  options: ResolvedOptions;
};

export type QueryStateTestingAdapterProps = {
  children: ReactNode;
  /** Initial query string (e.g. `"?count=42"`) or `URLSearchParams`. */
  searchParams?: string | URLSearchParams;
  defaultOptions?: QueryStateOptions;
  processUrlSearchParams?: (params: URLSearchParams) => URLSearchParams | void;
  /** Called whenever a URL commit fires, instead of touching the real URL. */
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
};

/**
 * Adapter for unit tests: drives `useQueryState`/`useQueryStates` from a static
 * search string and reports commits via `onUrlUpdate` — no router required.
 */
export function QueryStateTestingAdapter({
  children,
  searchParams = "",
  defaultOptions,
  processUrlSearchParams,
  onUrlUpdate,
}: QueryStateTestingAdapterProps) {
  const value = useMemo<AdapterValue>(() => {
    const store = createQueryStateStore({
      initialSearch: searchParams,
      processSearchParams: processUrlSearchParams,
      commit: ({ search, options }) => {
        onUrlUpdate?.({
          queryString: search.toString(),
          searchParams: new URLSearchParams(search),
          options,
        });
      },
    });
    return { store, defaultOptions: defaultOptions ?? {} };
    // Store is created once; `searchParams` is the initial value (re-synced
    // below when it changes), matching the nuqs testing adapter.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    value.store.syncFromSearch(searchParams);
  }, [searchParams, value.store]);

  return (
    <QueryStateAdapterContext.Provider value={value}>{children}</QueryStateAdapterContext.Provider>
  );
}
