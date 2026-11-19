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

/**
 * The React context every query-state adapter provides (`NuqsAdapter`,
 * `QueryStateTestingAdapter`) and that `useQueryState` / `useQueryStates` /
 * `useUrlSearchString` read. Its value is an {@link AdapterValue} (the shared
 * store plus adapter `defaultOptions`), or `null` outside an adapter, where
 * the hooks throw.
 *
 * Most apps never touch it. Read it to check whether an adapter is mounted,
 * e.g. in a component that may also render outside the router. The store
 * type and its factory are internal, so writing a new adapter on top of this
 * context means implementing the store contract yourself.
 *
 * @example
 * ```tsx
 * import { useContext } from "react";
 * import { QueryStateAdapterContext, useQueryState } from "@xtandard/lib/tanstack";
 *
 * function UrlSearchBox() {
 *   const [q, setQ] = useQueryState("q");
 *   return <input value={q ?? ""} onChange={(e) => void setQ(e.target.value || null)} />;
 * }
 *
 * function SearchBox() {
 *   const hasAdapter = useContext(QueryStateAdapterContext) !== null;
 *   return hasAdapter ? <UrlSearchBox /> : <input placeholder="Search" />;
 * }
 * ```
 */
export const QueryStateAdapterContext = AdapterContext;

export function useAdapterValue(): AdapterValue {
  const value = useContext(AdapterContext);
  if (value === null) {
    throw new Error(
      "useQueryState/useQueryStates require a query-params adapter. Wrap your " +
        "app in <NuqsAdapter> from @xtandard/lib/tanstack.",
    );
  }
  return value;
}
