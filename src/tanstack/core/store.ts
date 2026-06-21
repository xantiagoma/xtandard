import { combineResolvedOptions, type ResolvedOptions } from "./options.ts";

export type Snapshot = {
  readonly searchParams: URLSearchParams;
  readonly queryString: string;
};

export type CommitInput = {
  readonly search: URLSearchParams;
  readonly options: ResolvedOptions;
};

export type CommitFn = (input: CommitInput) => void;

export type StoreUpdate = {
  updater: (current: URLSearchParams) => URLSearchParams;
  options: ResolvedOptions;
};

export type QueryStateStore = {
  getSnapshot: () => Snapshot;
  subscribe: (listener: () => void) => () => void;
  /** Reconcile from an external URL change (router navigation / popstate). */
  syncFromSearch: (search: string | URLSearchParams) => void;
  /** Apply an optimistic per-key update and schedule a rate-limited commit. */
  update: (update: StoreUpdate) => Promise<URLSearchParams>;
};

function makeSnapshot(params: URLSearchParams): Snapshot {
  return { searchParams: params, queryString: params.toString() };
}

function normalize(search: string | URLSearchParams): URLSearchParams {
  return new URLSearchParams(search);
}

/**
 * Central optimistic store shared by every hook. State updates are applied
 * synchronously so all hooks on the same key stay in sync immediately, while
 * the actual URL commit is rate-limited and merged across same-tick updates.
 */
export function createQueryStateStore(config: {
  initialSearch: string | URLSearchParams;
  commit: CommitFn;
  processSearchParams?: (params: URLSearchParams) => URLSearchParams | void;
}): QueryStateStore {
  let snapshot = makeSnapshot(normalize(config.initialSearch));
  const listeners = new Set<() => void>();

  type Pending = {
    options: ResolvedOptions;
    promise: Promise<URLSearchParams>;
    resolve: (value: URLSearchParams) => void;
  };
  let pending: Pending | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const setSnapshot = (params: URLSearchParams): void => {
    snapshot = makeSnapshot(params);
    notify();
  };

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const finalizeWithoutCommit = (): void => {
    if (!pending) return;
    const { resolve } = pending;
    pending = null;
    resolve(snapshot.searchParams);
  };

  const flush = (): void => {
    timer = null;
    if (!pending) return;
    const { options, resolve } = pending;
    pending = null;
    config.commit({ search: snapshot.searchParams, options });
    resolve(snapshot.searchParams);
  };

  const arm = (): void => {
    if (!pending) return;
    const { method, timeMs } = pending.options.limitUrlUpdates;
    if (timeMs === Infinity) {
      clearTimer();
      queueMicrotask(finalizeWithoutCommit);
      return;
    }
    if (method === "debounce") {
      clearTimer();
      timer = setTimeout(flush, timeMs);
    } else if (timer === null) {
      // throttle: leave an already-armed timer in place.
      timer = setTimeout(flush, timeMs);
    }
  };

  const schedule = (options: ResolvedOptions): Promise<URLSearchParams> => {
    if (!pending) {
      const { promise, resolve } = Promise.withResolvers<URLSearchParams>();
      pending = { options, promise, resolve };
    } else {
      pending.options = combineResolvedOptions(pending.options, options);
    }
    arm();
    return pending.promise;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    syncFromSearch: (search) => {
      const next = normalize(search);
      if (next.toString() === snapshot.queryString) return;
      setSnapshot(next);
    },
    update: ({ updater, options }) => {
      let next = updater(snapshot.searchParams);
      if (config.processSearchParams) {
        const processed = config.processSearchParams(next);
        if (processed) next = processed;
      }
      setSnapshot(next);
      return schedule(options);
    },
  };
}
