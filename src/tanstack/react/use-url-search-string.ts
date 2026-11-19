import { useSyncExternalStore } from "react";

import { useAdapterValue } from "./context.ts";

/**
 * Reactive read of the full URL query string from the adapter store. Unlike a
 * router hook, this reflects **shallow** updates (History-API writes that don't
 * fire router/popstate events). Useful for debugging and live URL readouts.
 *
 * Returns the store's optimistic query string without a leading `?`
 * (`"page=2&sort=name"`, or `""`). It updates as soon as a setter is called,
 * before the rate-limited URL commit.
 *
 * @example
 * ```tsx
 * import { useUrlSearchString } from "@xtandard/lib/tanstack";
 *
 * function UrlDebug() {
 *   const search = useUrlSearchString(); // e.g. "q=shoes&page=2"
 *   return <code>?{search}</code>;
 * }
 * ```
 */
export function useUrlSearchString(): string {
  const { store } = useAdapterValue();
  const read = (): string => store.getSnapshot().queryString;
  return useSyncExternalStore(store.subscribe, read, read);
}
