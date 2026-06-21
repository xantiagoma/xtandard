import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { inferParserMapType, ParserMap } from "../core/parser.ts";

import { type QueryStateOptions, resolveOptions } from "../core/options.ts";
import { hasInvalidKey, keyToken, readKey, writeKey } from "../core/urlsearchparams.ts";
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
      const resolved = resolveOptions({
        callOptions,
        hookOptions: options,
        adapterDefaults: defaultOptions,
      });
      return store.update({
        options: resolved,
        updater: (current) => {
          const draft = new URLSearchParams(current);
          const clearAll = (): void => {
            for (const key of Object.keys(parsers)) draft.delete(urlKeyFor(key));
          };
          if (next === null) {
            clearAll();
            return draft;
          }
          const patch = typeof next === "function" ? next(readAll(current)) : next;
          if (patch === null) {
            clearAll();
            return draft;
          }
          for (const [key, parser] of Object.entries(parsers)) {
            if (!(key in patch)) continue;
            const value: unknown = Reflect.get(patch, key);
            const clearOnDefault = parser.options?.clearOnDefault ?? resolved.clearOnDefault;
            writeKey(
              draft,
              urlKeyFor(key),
              parser,
              value === undefined ? null : value,
              clearOnDefault,
            );
          }
          return draft;
        },
      });
    },
    [store, parsers, options, defaultOptions, urlKeyFor, readAll],
  );

  // Auto-strip present-but-invalid raw values from the URL (clearOnInvalid), in
  // one atomic commit covering every managed key that fails to parse.
  useEffect(() => {
    const resolved = resolveOptions({ hookOptions: options, adapterDefaults: defaultOptions });
    if (!resolved.clearOnInvalid) return;

    const current = store.getSnapshot().searchParams;
    const invalid = Object.entries(parsers)
      .filter(([key, parser]) => hasInvalidKey(current, urlKeyFor(key), parser))
      .map(([key]) => urlKeyFor(key));

    if (invalid.length === 0) return;

    void store.update({
      options: resolved,
      updater: (params) => {
        const draft = new URLSearchParams(params);
        for (const key of invalid) draft.delete(key);

        return draft;
      },
    });
    // `token` captures every managed key's raw value; cleared → no-op next run.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [token, parsers, urlKeyFor]);

  return [values, setValues];
}
