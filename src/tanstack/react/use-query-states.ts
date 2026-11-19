import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { inferParserMapType, ParserMap } from "../core/parser.ts";

import type { QueryStateOptions } from "../core/options.ts";

import { planInvalidStrip, planKeyedUpdate } from "../core/query-states.ts";
import { keyToken, readKey } from "../core/urlsearchparams.ts";
import { useAdapterValue } from "./context.ts";

export type UseQueryStatesOptions<M extends ParserMap> = QueryStateOptions & {
  /** Map logical state keys to (typically shorter) URL keys. */
  urlKeys?: Partial<Record<keyof M, string>>;
};

export type SetValues<M extends ParserMap> = (
  next:
    | Partial<inferParserMapType<M>>
    | null
    | ((previous: inferParserMapType<M>) => Partial<inferParserMapType<M>> | null),
  options?: QueryStateOptions,
) => Promise<URLSearchParams>;

/**
 * Like `useQueryState`, but for several keys that move together. All keys
 * update atomically in a single URL commit; unmanaged params are preserved;
 * passing `null` clears every managed key.
 *
 * The setter takes a partial object (only the keys present are written; a
 * key set to `null` is removed), `null`, or an updater receiving all current
 * values. `options.urlKeys` maps state keys to shorter URL keys; the other
 * options apply to every key.
 *
 * Options resolve per key: per-call > that key's parser `.withOptions()` >
 * hook options > adapter defaults. Each written key uses its own
 * `clearOnDefault`; the single URL commit merges the keys' options the way
 * same-tick updates merge (`push` beats `replace`, a full navigation beats
 * shallow, the strongest rate limit wins).
 *
 * @example
 * ```tsx
 * import { parseAsIndex, parseAsString, useQueryStates } from "@xtandard/lib/tanstack";
 *
 * const tableSearch = {
 *   pageIndex: parseAsIndex.withDefault(0),
 *   sort: parseAsString.withDefault("createdAt"),
 * };
 *
 * function Table() {
 *   // ?page=2&sort=name → { pageIndex: 1, sort: "name" }
 *   const [{ pageIndex, sort }, setSearch] = useQueryStates(tableSearch, {
 *     urlKeys: { pageIndex: "page" },
 *   });
 *   // setSearch({ sort: "email", pageIndex: 0 }) → one commit: ?sort=email
 *   // setSearch(null) → removes page and sort, keeps other params
 * }
 * ```
 */
export function useQueryStates<M extends ParserMap>(
  parsers: M,
  options?: UseQueryStatesOptions<M>,
): readonly [inferParserMapType<M>, SetValues<M>] {
  const { store, defaultOptions } = useAdapterValue();
  const urlKeys = options?.urlKeys;
  const urlKeyFor = useCallback(
    (key: string): string => {
      const mapped = urlKeys?.[key];
      return typeof mapped === "string" ? mapped : key;
    },
    [urlKeys],
  );

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const readAll = useCallback(
    (params: URLSearchParams): inferParserMapType<M> => {
      const result: Record<string, unknown> = {};
      for (const [key, parser] of Object.entries(parsers)) {
        result[key] = readKey(params, urlKeyFor(key), parser);
      }
      // Boundary cast: built from the parser map, matches inferParserMapType<M>.
      return result as inferParserMapType<M>;
    },
    [parsers, urlKeyFor],
  );

  const token = useMemo(() => {
    const parts: string[] = [];
    for (const [key, parser] of Object.entries(parsers)) {
      parts.push(`${key}:${keyToken(snapshot.searchParams, urlKeyFor(key), parser.kind)}`);
    }
    return parts.join("&");
  }, [snapshot.searchParams, parsers, urlKeyFor]);

  const values = useMemo(
    () => readAll(snapshot.searchParams),
    // `token` captures every managed key's raw value.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [token, readAll],
  );

  const setValues: SetValues<M> = useCallback(
    (next, callOptions) => {
      // The store runs the updater synchronously on its current snapshot, so
      // resolving the patch here sees the same params the updater would.
      const patch =
        typeof next === "function" ? next(readAll(store.getSnapshot().searchParams)) : next;
      const plan = planKeyedUpdate({
        parsers,
        urlKeyFor,
        patch,
        callOptions,
        hookOptions: options,
        adapterDefaults: defaultOptions,
      });
      return store.update({ options: plan.options, updater: plan.apply });
    },
    [store, parsers, options, defaultOptions, urlKeyFor, readAll],
  );

  // Auto-strip present-but-invalid raw values from the URL (clearOnInvalid), in
  // one atomic commit covering every managed key that fails to parse.
  useEffect(() => {
    const plan = planInvalidStrip({
      parsers,
      urlKeyFor,
      params: store.getSnapshot().searchParams,
      hookOptions: options,
      adapterDefaults: defaultOptions,
    });
    if (plan === null) return;

    void store.update({
      options: plan.options,
      updater: (params) => {
        const draft = new URLSearchParams(params);
        for (const key of plan.urlKeys) draft.delete(key);

        return draft;
      },
    });
    // `token` captures every managed key's raw value; cleared → no-op next run.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [token, parsers, urlKeyFor]);

  return [values, setValues];
}
