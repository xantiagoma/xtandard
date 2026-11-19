import type { ParserMap } from "./parser.ts";

import {
  combineResolvedOptions,
  type QueryStateOptions,
  type ResolvedOptions,
  resolveOptions,
} from "./options.ts";
import { hasInvalidKey, writeKey } from "./urlsearchparams.ts";

/**
 * Multi-key (`useQueryStates`) option resolution, React-free so it can be
 * tested in node. Options resolve per key, like nuqs: call > that key's parser
 * `.withOptions()` > hook > adapter defaults > library defaults. A key's
 * resolved `clearOnDefault` decides whether that key is removed; the commit
 * options of all touched keys merge with `combineResolvedOptions` (the same
 * "loudest wins" rule the store uses for same-tick updates from separate hooks).
 */
type Layers = {
  callOptions?: QueryStateOptions;
  hookOptions?: QueryStateOptions;
  adapterDefaults?: QueryStateOptions;
};

function combineAll(resolved: ResolvedOptions[], fallback: ResolvedOptions): ResolvedOptions {
  const [first, ...rest] = resolved;
  if (first === undefined) return fallback;
  return rest.reduce(combineResolvedOptions, first);
}

export type KeyedUpdate = {
  /** Commit options merged across every key the update touches. */
  options: ResolvedOptions;
  /** Apply the writes to the current params (returns a new object). */
  apply: (current: URLSearchParams) => URLSearchParams;
};

/**
 * Plan a `useQueryStates` write. `patch === null` clears every managed key;
 * otherwise only keys present in `patch` are written (`undefined`/`null`
 * remove the key).
 */
export function planKeyedUpdate(
  input: Layers & {
    parsers: ParserMap;
    urlKeyFor: (key: string) => string;
    patch: Record<string, unknown> | null;
  },
): KeyedUpdate {
  const { parsers, urlKeyFor, patch, callOptions, hookOptions, adapterDefaults } = input;
  const writes: Array<{ key: string; value: unknown; resolved: ResolvedOptions }> = [];
  for (const [key, parser] of Object.entries(parsers)) {
    if (patch !== null && !(key in patch)) continue;
    const value: unknown = patch === null ? null : Reflect.get(patch, key);
    const resolved = resolveOptions({
      callOptions,
      parserOptions: parser.options,
      hookOptions,
      adapterDefaults,
    });
    writes.push({ key, value: value === undefined ? null : value, resolved });
  }
  const fallback = resolveOptions({ callOptions, hookOptions, adapterDefaults });
  return {
    options: combineAll(
      writes.map((write) => write.resolved),
      fallback,
    ),
    apply: (current) => {
      const draft = new URLSearchParams(current);
      for (const { key, value, resolved } of writes) {
        // `parsers[key]` exists: `writes` is built from the same map.
        const parser = parsers[key];
        if (parser) writeKey(draft, urlKeyFor(key), parser, value, resolved.clearOnDefault);
      }
      return draft;
    },
  };
}

/**
 * Plan the `clearOnInvalid` strip for `useQueryStates`: the URL keys that are
 * present but fail to parse and whose resolved `clearOnInvalid` (parser >
 * hook > adapter) is on. `null` when there is nothing to strip.
 */
export function planInvalidStrip(
  input: Omit<Layers, "callOptions"> & {
    parsers: ParserMap;
    urlKeyFor: (key: string) => string;
    params: URLSearchParams;
  },
): { urlKeys: string[]; options: ResolvedOptions } | null {
  const { parsers, urlKeyFor, params, hookOptions, adapterDefaults } = input;
  const urlKeys: string[] = [];
  const resolvedList: ResolvedOptions[] = [];
  for (const [key, parser] of Object.entries(parsers)) {
    const resolved = resolveOptions({
      parserOptions: parser.options,
      hookOptions,
      adapterDefaults,
    });
    if (!resolved.clearOnInvalid) continue;
    const urlKey = urlKeyFor(key);
    if (!hasInvalidKey(params, urlKey, parser)) continue;
    urlKeys.push(urlKey);
    resolvedList.push(resolved);
  }
  if (urlKeys.length === 0) return null;
  return {
    urlKeys,
    options: combineAll(resolvedList, resolveOptions({ hookOptions, adapterDefaults })),
  };
}
