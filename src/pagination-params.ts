import type { CursorPagination, PaginationInput } from "./pagination.ts";

/** Loose param bag: URLSearchParams or a parsed query/body object. */
export type PaginationParamsSource =
  | URLSearchParams
  | Record<string, string | number | string[] | undefined | null>;

export type ParsePaginationParamsOptions = {
  /** Used when no size param is present. Default: `20`. */
  defaultPageSize?: number;
  /** Untrusted input is clamped to this. Default: `100`. Pass `Infinity` to disable. */
  maxPageSize?: number;
  /** Style assumed when no style-specific params are present. Default: `"page"`. */
  fallback?: "page" | "offset" | "cursor";
};

function readParam(source: PaginationParamsSource, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source instanceof URLSearchParams ? source.get(key) : (source[key] ?? undefined);
    if (value === undefined || value === null) {
      continue;
    }
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined && single !== "") {
      return String(single);
    }
  }
  return undefined;
}

function readInt(source: PaginationParamsSource, keys: string[]): number | undefined {
  const raw = readParam(source, keys);
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse untrusted transport params (query string, parsed body...) into a
 * `PaginationInput`, with sane defaults and clamping.
 *
 * Style detection, in precedence order:
 * 1. cursor — `cursor`, `after` or `before` present (`before` ⇒ backward)
 * 2. offset — `offset` or `skip` present (`limit`/`take` set the size)
 * 3. page   — `page` present (`page_size`/`pageSize`/`per_page`/`perPage`/`size`)
 * 4. otherwise the `fallback` style with defaults
 *
 * @example
 * ```ts
 * parsePaginationParams(new URL(req.url).searchParams);
 * // ?page=3&per_page=25        → { type: "page", page: 3, pageSize: 25 }
 * // ?limit=10&offset=40        → { type: "offset", limit: 10, offset: 40 }
 * // ?cursor=abc&direction=backward → { type: "cursor", limit: 20, cursor: "abc", direction: "backward" }
 * ```
 */
export function parsePaginationParams(
  source: PaginationParamsSource,
  options: ParsePaginationParamsOptions = {},
): PaginationInput {
  const { defaultPageSize = 20, maxPageSize = 100, fallback = "page" } = options;

  const clamp = (size: number | undefined): number =>
    Math.min(Math.max(1, Math.trunc(size ?? defaultPageSize)), maxPageSize);

  const sizeParam = readInt(source, [
    "page_size",
    "pageSize",
    "per_page",
    "perPage",
    "size",
    "limit",
    "take",
    "first",
    "last",
  ]);
  const limit = clamp(sizeParam);

  const cursor = readParam(source, ["cursor", "after"]);
  const before = readParam(source, ["before"]);
  if (cursor !== undefined || before !== undefined) {
    const direction =
      before !== undefined || readParam(source, ["direction"]) === "backward"
        ? "backward"
        : "forward";
    return { type: "cursor", limit, cursor: before ?? cursor, direction };
  }

  const offset = readInt(source, ["offset", "skip"]);
  if (offset !== undefined) {
    return { type: "offset", limit, offset: Math.max(0, offset) };
  }

  const page = readInt(source, ["page"]);
  if (page !== undefined) {
    return { type: "page", page: Math.max(1, page), pageSize: limit };
  }

  switch (fallback) {
    case "cursor":
      return { type: "cursor", limit, direction: "forward" };
    case "offset":
      return { type: "offset", limit, offset: 0 };
    default:
      return { type: "page", page: 1, pageSize: limit };
  }
}

/** GraphQL connection arguments, per the Relay Cursor Connections spec. */
export type RelayArgs = {
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
};

/**
 * Convert Relay connection args into a `CursorPagination` input:
 * `last`/`before` paginate backward, `first`/`after` paginate forward.
 *
 * @example
 * ```ts
 * fromRelayArgs({ first: 10, after: "abc" });
 * // { type: "cursor", limit: 10, cursor: "abc", direction: "forward" }
 * fromRelayArgs({ last: 5, before: "xyz" });
 * // { type: "cursor", limit: 5, cursor: "xyz", direction: "backward" }
 * ```
 */
export function fromRelayArgs(
  args: RelayArgs,
  options: Pick<ParsePaginationParamsOptions, "defaultPageSize" | "maxPageSize"> = {},
): CursorPagination {
  const { defaultPageSize = 20, maxPageSize = 100 } = options;
  const clamp = (size: number | undefined | null): number =>
    Math.min(Math.max(1, Math.trunc(size ?? defaultPageSize)), maxPageSize);

  if (args.last != null || args.before != null) {
    return {
      type: "cursor",
      limit: clamp(args.last),
      cursor: args.before ?? undefined,
      direction: "backward",
    };
  }
  return {
    type: "cursor",
    limit: clamp(args.first),
    cursor: args.after ?? undefined,
    direction: "forward",
  };
}
