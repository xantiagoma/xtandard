import { useSyncExternalStore } from "react";

import { useAdapterValue } from "./context.ts";

/**
 * Reactive read of the full URL query string from the adapter store. Unlike a
 * router hook, this reflects **shallow** updates (History-API writes that don't
 * fire router/popstate events). Useful for debugging and live URL readouts.
 */
export function useUrlSearchString(): string {
  const { store } = useAdapterValue();
  const read = (): string => store.getSnapshot().queryString;
  return useSyncExternalStore(store.subscribe, read, read);
}
