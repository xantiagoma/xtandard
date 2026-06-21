import { createContext, useContext } from "react";

import type { QueryStateOptions } from "../core/options.ts";
import type { QueryStateStore } from "../core/store.ts";

export type AdapterValue = {
  store: QueryStateStore;
  /** Adapter-level option defaults, below hook/parser/call options. */
  defaultOptions: QueryStateOptions;
};

const AdapterContext = createContext<AdapterValue | null>(null);
AdapterContext.displayName = "QueryStateAdapterContext";

export const QueryStateAdapterContext = AdapterContext;

export function useAdapterValue(): AdapterValue {
  const value = useContext(AdapterContext);
  if (value === null) {
    throw new Error(
      "useQueryState/useQueryStates require a query-params adapter. Wrap your " +
        "app in <NuqsAdapter> from xantiagoma/tanstack.",
    );
  }
  return value;
}
