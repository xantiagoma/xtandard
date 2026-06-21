import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { type QueryStateOptions, resolveOptions } from "../core/options.ts";
import { type AnyParser, createParser, type inferParserType } from "../core/parser.ts";
import { hasInvalidKey, keyToken, readKey, writeKey } from "../core/urlsearchparams.ts";
import { useAdapterValue } from "./context.ts";

export type Setter<Read> = (
  value: Read | null | ((previous: Read) => Read | null),
  options?: QueryStateOptions,
) => Promise<URLSearchParams>;

/** Read value for a given parser argument; defaults to `string | null`. */
// oxlint-disable-next-line typescript/no-explicit-any -- variance constraint (see ParserMap)
type ReadValue<P> = P extends AnyParser<any> ? inferParserType<P> : string | null;

/**
 * Default parser when none is passed: identity in, `String()` out. Typed
 * `Parser<unknown>` (not `Parser<string>`) so it serves as a generic default
 * without a cast; the public no-parser case reports `string | null`.
 */
const defaultParser = createParser<unknown>({
  parse: (value) => value,
  serialize: (value) => String(value),
});

/**
 * `useState`, but backed by a single URL query key. Route-agnostic: components
 * never import a route object. See `useQueryStates` for multiple keys.
 *
 *   const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1))
 *   setPage(null) // removes the key
 */
// oxlint-disable-next-line typescript/no-explicit-any -- variance constraint (see ParserMap)
export function useQueryState<P extends AnyParser<any> | undefined = undefined>(
  key: string,
  parser?: P,
): readonly [ReadValue<P>, Setter<ReadValue<P>>] {
  const { store, defaultOptions } = useAdapterValue();
  const active: AnyParser<unknown> = parser ?? defaultParser;

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const token = keyToken(snapshot.searchParams, key, active.kind);
  const value = useMemo(
    () => readKey(snapshot.searchParams, key, active),
    // `token` (the key's raw value) gates recomputation; reading from the
    // captured snapshot is sound because the value only changes when token does.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [token, active, key],
  );

  const setValue = useCallback(
    (
      next: unknown | ((previous: unknown) => unknown),
      callOptions?: QueryStateOptions,
    ): Promise<URLSearchParams> => {
      const resolved = resolveOptions({
        callOptions,
        parserOptions: active.options,
        adapterDefaults: defaultOptions,
      });
      return store.update({
        options: resolved,
        updater: (current) => {
          const previous = readKey(current, key, active);
          const nextValue: unknown = typeof next === "function" ? next(previous) : next;
          const draft = new URLSearchParams(current);
          writeKey(draft, key, active, nextValue, resolved.clearOnDefault);
          return draft;
        },
      });
    },
    [store, key, active, defaultOptions],
  );

  // Auto-strip a present-but-invalid raw value from the URL (clearOnInvalid),
  // so stale/garbage tokens resolve cleanly to the default instead of lingering.
  useEffect(() => {
    const resolved = resolveOptions({
      parserOptions: active.options,
      adapterDefaults: defaultOptions,
    });
    if (!resolved.clearOnInvalid) return;

    const current = store.getSnapshot().searchParams;
    if (!hasInvalidKey(current, key, active)) return;

    void store.update({
      options: resolved,
      updater: (params) => {
        const draft = new URLSearchParams(params);
        draft.delete(key);

        return draft;
      },
    });
    // `token` (the raw value) gates re-runs; cleared key → token null → no-op.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [token, active, key]);

  // Boundary cast: `value`/`setValue` are computed by the same parser logic the
  // return type (`ReadValue<P>`) is derived from.
  return [value, setValue] as readonly [ReadValue<P>, Setter<ReadValue<P>>];
}
