import { useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useRef } from "react";

import type { QueryStateOptions } from "../core/options.ts";

import { type CommitInput, createQueryStateStore } from "../core/store.ts";
import { type AdapterValue, QueryStateAdapterContext } from "../react/context.ts";

type AnyRouter = ReturnType<typeof useRouter>;

const hasWindow = (): boolean => typeof window !== "undefined";

/**
 * The RAW current search string. We read `router.history.location` (not
 * router-core's `location.searchStr`) because the latter is re-serialized with
 * TanStack's global JSON.stringify — collapsing repeated keys (`?tag=a&tag=b`)
 * into `?tag=["a","b"]`. `history.location.search` is the verbatim URL
 * substring, identical on the client and during SSR/Start, so per-key and
 * native-array formats survive and the server snapshot matches the client.
 */
function currentSearch(router: AnyRouter): string {
  return router.history.location.search;
}

/** Default: standard `application/x-www-form-urlencoded` serialization. */
const defaultSerializeSearch = (params: URLSearchParams): string => params.toString();

function buildHref(
  router: AnyRouter,
  search: URLSearchParams,
  serializeSearch: (params: URLSearchParams) => string,
): string {
  const { pathname, hash } = router.history.location;
  const query = serializeSearch(search);
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function commit(
  router: AnyRouter,
  { search, options }: CommitInput,
  serializeSearch: (params: URLSearchParams) => string,
): void {
  const href = buildHref(router, search, serializeSearch);
  if (options.shallow) {
    // Component-local update: touch the URL via the History API only, so route
    // loaders / SSR don't run. Preserve `window.history.state`.
    if (hasWindow()) {
      const method = options.history === "push" ? "pushState" : "replaceState";
      window.history[method](window.history.state, "", href);
    }
    return;
  }
  // Loader/SSR-sensitive update: route through TanStack navigation.
  const navigate = (): void => {
    void router.navigate({
      href,
      replace: options.history !== "push",
      resetScroll: options.scroll,
    });
  };
  if (options.startTransition) options.startTransition(navigate);
  else navigate();
}

export type TanStackQueryStateAdapterProps = {
  children: ReactNode;
  /** Adapter-level option defaults (below hook/parser/call options). */
  defaultOptions?: QueryStateOptions;
  /** Middleware run on the merged params before they are stored/committed. */
  processUrlSearchParams?: (params: URLSearchParams) => URLSearchParams | void;
  /**
   * Render the final query string from the merged params. Defaults to standard
   * `URLSearchParams.toString()`. Pass `keepSubDelims` to keep `( ) , : ! '`
   * raw (readable Rison/structured tokens). Must round-trip through
   * `new URLSearchParams(...)`.
   */
  serializeSearch?: (params: URLSearchParams) => string;
};

/**
 * Bridges the query-params store to TanStack Router. Shallow updates (default)
 * write the URL directly; `shallow: false` updates navigate through the router
 * so loaders, validation, pending state, and Start SSR participate.
 */
export function TanStackQueryStateAdapter({
  children,
  defaultOptions,
  processUrlSearchParams,
  serializeSearch,
}: TanStackQueryStateAdapterProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const serializeRef = useRef(serializeSearch ?? defaultSerializeSearch);
  serializeRef.current = serializeSearch ?? defaultSerializeSearch;

  const value = useMemo<AdapterValue>(() => {
    const store = createQueryStateStore({
      initialSearch: currentSearch(routerRef.current),
      processSearchParams: processUrlSearchParams,
      commit: (input) => commit(routerRef.current, input, serializeRef.current),
    });
    return { store, defaultOptions: defaultOptions ?? {} };
    // Store is created once; router is read via ref so commits always use the
    // latest instance without recreating the store.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile when the router's location changes (links, programmatic nav,
  // non-shallow commits, popstate the router observes, and — because
  // @tanstack/history patches pushState/replaceState — our own shallow writes).
  // `searchStr` is only the change trigger; we read the verbatim search from
  // `history.location` (see `currentSearch`) so TanStack's global JSON
  // serialization never corrupts our per-key/native-array format.
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  useEffect(() => {
    value.store.syncFromSearch(currentSearch(routerRef.current));
  }, [searchStr, value.store]);

  // Back/forward over shallow (History-API) updates the router doesn't track.
  useEffect(() => {
    if (!hasWindow()) return;
    const onPopState = (): void => value.store.syncFromSearch(currentSearch(routerRef.current));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [value.store]);

  return (
    <QueryStateAdapterContext.Provider value={value}>{children}</QueryStateAdapterContext.Provider>
  );
}

/** nuqs-compatible alias. */
export { TanStackQueryStateAdapter as NuqsAdapter };

export { keepSubDelims } from "../core/urlsearchparams.ts";
