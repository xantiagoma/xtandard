import type { inferParserMapType, ParserMap } from "./parser.ts";

import { writeKey } from "./urlsearchparams.ts";

export type SerializerValues<M extends ParserMap> = {
  [K in keyof M]?: inferParserMapType<M>[K] | null;
};

export type CreateSerializerOptions<M extends ParserMap> = {
  clearOnDefault?: boolean;
  urlKeys?: Partial<Record<keyof M, string>>;
  /** Middleware on the merged params before they're serialized to a string. */
  processUrlSearchParams?: (params: URLSearchParams) => URLSearchParams | void;
};

/** Base URL or query a serializer merges into: a string, `URL` or `URLSearchParams`. */
export type Base = string | URL | URLSearchParams;

function baseParams(base: Base | undefined): URLSearchParams {
  if (base === undefined) return new URLSearchParams();
  if (base instanceof URL) return new URLSearchParams(base.search);
  if (base instanceof URLSearchParams) return new URLSearchParams(base);
  const queryStart = base.indexOf("?");
  if (queryStart === -1) return new URLSearchParams();
  const hashStart = base.indexOf("#");
  const end = hashStart === -1 ? base.length : hashStart;
  return new URLSearchParams(base.slice(queryStart, end));
}

function isBase(value: unknown): value is Base {
  return typeof value === "string" || value instanceof URL || value instanceof URLSearchParams;
}

/**
 * Build a query string or URL from a parser map. Preserves unrelated params on
 * the base, removes keys set to `null`, and honors `clearOnDefault`/`urlKeys`.
 *
 * Call it with just values for a query string (`"?…"`, or `""` when empty), or
 * with a base (path string, `URL` or `URLSearchParams`) first to merge into
 * it. A string base keeps its path and `#hash`; a `URL` base returns a full href.
 *
 * @example
 * ```ts
 * import { createSerializer, parseAsIndex, parseAsString } from "@xtandard/lib/tanstack/server";
 *
 * const serialize = createSerializer({
 *   q: parseAsString,
 *   page: parseAsIndex.withDefault(0),
 * });
 *
 * serialize({ q: "x", page: 2 }); // → "?q=x&page=3"
 * serialize({ page: 0 }); // → "" (default cleared)
 * serialize("/users?tab=all#top", { q: "x" }); // → "/users?tab=all&q=x#top"
 * serialize("/users?q=old&tab=all", { q: null }); // → "/users?tab=all"
 * serialize(new URL("https://h/u?a=1"), {}); // → "https://h/u?a=1"
 * ```
 */
export function createSerializer<M extends ParserMap>(
  parsers: M,
  options?: CreateSerializerOptions<M>,
) {
  const clearOnDefault = options?.clearOnDefault ?? true;
  const urlKeyFor = (key: string): string => {
    const mapped = options?.urlKeys?.[key];
    return typeof mapped === "string" ? mapped : key;
  };

  function serialize(values: SerializerValues<M>): string;
  function serialize(base: Base, values?: SerializerValues<M>): string;
  function serialize(
    baseOrValues: Base | SerializerValues<M>,
    maybeValues?: SerializerValues<M>,
  ): string {
    const hasBase = isBase(baseOrValues);
    const base = hasBase ? baseOrValues : undefined;
    const values: SerializerValues<M> = hasBase ? (maybeValues ?? {}) : baseOrValues;

    let params = baseParams(base);
    for (const [key, parser] of Object.entries(parsers)) {
      if (!(key in values)) continue;
      const value: unknown = Reflect.get(values, key);
      writeKey(params, urlKeyFor(key), parser, value === undefined ? null : value, clearOnDefault);
    }
    if (options?.processUrlSearchParams) {
      params = options.processUrlSearchParams(params) ?? params;
    }

    const query = params.toString();
    if (base instanceof URL) {
      const url = new URL(base.href);
      url.search = query;
      return url.href;
    }
    if (typeof base === "string") {
      const hashStart = base.indexOf("#");
      const hash = hashStart === -1 ? "" : base.slice(hashStart);
      const queryStart = base.indexOf("?");
      const path =
        queryStart === -1
          ? hashStart === -1
            ? base
            : base.slice(0, hashStart)
          : base.slice(0, queryStart);
      return `${path}${query ? `?${query}` : ""}${hash}`;
    }
    return query ? `?${query}` : "";
  }

  return serialize;
}
