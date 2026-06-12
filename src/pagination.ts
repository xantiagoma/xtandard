import type { MaybePromise } from "./types.ts";
import { type CursorCodec, type CursorCodecMaybeAsync, createCursorCodec } from "./cursor-codec.ts";
import { chainMaybePromise } from "./resolve-maybe-promise.ts";
import { isPromise } from "./is-promise.ts";

/** `page`/`pageSize` style (1-based), as in `?page=3&page_size=20`. */
export type PagePagination = { type: "page"; page: number; pageSize: number };

/** `limit`/`offset` style, as in SQL `LIMIT 20 OFFSET 40`. */
export type OffsetPagination = { type: "offset"; limit: number; offset: number };

/**
 * `forward` walks the natural order of the source (older items in a feed);
 * `backward` walks against it (newer items — "scroll up").
 */
export type CursorDirection = "forward" | "backward";

/** Opaque-cursor style: `cursor` is absent on the first request. */
export type CursorPagination = {
  type: "cursor";
  limit: number;
  cursor?: string | null;
  direction?: CursorDirection;
};

/** Any supported pagination request, discriminated by `type`. */
export type PaginationInput = PagePagination | OffsetPagination | CursorPagination;

/**
 * Normalized window handed to `fetchOffset`. `limit` already includes the
 * one-row lookahead — fetch up to `limit` rows starting at `offset`.
 */
export type OffsetWindow = { limit: number; offset: number };

/**
 * Normalized window handed to `fetchCursor`. `limit` already includes the
 * one-row lookahead. `cursor` is the decoded cursor data (`null` for the
 * first page). When `direction` is `"backward"` the fetcher must flip its
 * sort order; the paginator restores natural order afterwards.
 */
export type CursorWindow<TCursor = Record<string, unknown>> = {
  limit: number;
  cursor: TCursor | null;
  direction: CursorDirection;
};

/** What fetchers return. `totalItems` is optional — provide it if cheap. */
export type PaginationFetchResult<T> = { items: T[]; totalItems?: number };

export type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  /** Cursor of the first/last item — present when cursors are configured. */
  startCursor?: string | null;
  endCursor?: string | null;
  /** Present for page/offset requests. */
  page?: number;
  pageSize?: number;
  /** Present when the fetcher reported `totalItems`. */
  totalItems?: number;
  totalPages?: number;
};

/** Uniform pagination envelope, whatever the input style or data source. */
export type Paginated<T> = { items: T[]; pageInfo: PageInfo };

/**
 * Convert page or offset input into a `{ limit, offset }` window
 * (`page` is 1-based). Cursor input is intentionally not convertible.
 */
export function toOffsetWindow(input: PagePagination | OffsetPagination): OffsetWindow {
  if (input.type === "page") {
    const pageSize = Math.max(1, Math.trunc(input.pageSize));
    const page = Math.max(1, Math.trunc(input.page));
    return { limit: pageSize, offset: (page - 1) * pageSize };
  }
  return {
    limit: Math.max(1, Math.trunc(input.limit)),
    offset: Math.max(0, Math.trunc(input.offset)),
  };
}

export type PaginatorCursorOptionsSync<T, TCursor extends Record<string, unknown>> = {
  /** Extract the cursor data for an item (e.g. `(u) => ({ id: u.id })`). */
  fromItem: (item: T) => TCursor;
  /** Token codec. Default: `createCursorCodec()` (JSON + base64url, sync). */
  codec?: CursorCodec<TCursor>;
};

export type PaginatorCursorOptions<T, TCursor extends Record<string, unknown>> = {
  /** Extract the cursor data for an item (e.g. `(u) => ({ id: u.id })`). */
  fromItem: (item: T) => TCursor;
  /** Token codec, possibly with async stages. */
  codec?: CursorCodecMaybeAsync<TCursor>;
};

/** All-sync configuration: sync fetchers and a sync codec. */
export type CreatePaginatorOptionsSync<T, TCursor extends Record<string, unknown>> = {
  fetchOffset?: (window: OffsetWindow) => PaginationFetchResult<T>;
  fetchCursor?: (window: CursorWindow<TCursor>) => PaginationFetchResult<T>;
  cursor?: PaginatorCursorOptionsSync<T, TCursor>;
  maxLimit?: number;
};

/** Possibly-async fetchers with a sync codec — the common case. */
export type CreatePaginatorOptions<T, TCursor extends Record<string, unknown>> = {
  /**
   * Fetch for page/offset requests (SQL OFFSET, Mongo `.skip()`, REST
   * `?offset=`...). Fetch up to `window.limit` rows — it includes a one-row
   * lookahead used to compute `hasNextPage`, so do not cap it yourself.
   */
  fetchOffset?: (window: OffsetWindow) => MaybePromise<PaginationFetchResult<T>>;
  /**
   * Fetch for cursor requests (keyset SQL via drizzle-cursor, Mongo range
   * queries...). Fetch up to `window.limit` rows after/before
   * `window.cursor`, flipping sort order when `window.direction` is
   * `"backward"`.
   */
  fetchCursor?: (window: CursorWindow<TCursor>) => MaybePromise<PaginationFetchResult<T>>;
  /** Required for cursor pagination and for cursors in page/offset results. */
  cursor?: PaginatorCursorOptionsSync<T, TCursor>;
  /** Hard cap applied to any requested limit/pageSize. Default: no cap. */
  maxLimit?: number;
};

/** Loosest configuration: fetchers and codec stages may all be async. */
export type CreatePaginatorOptionsMaybeAsync<T, TCursor extends Record<string, unknown>> = {
  fetchOffset?: (window: OffsetWindow) => MaybePromise<PaginationFetchResult<T>>;
  fetchCursor?: (window: CursorWindow<TCursor>) => MaybePromise<PaginationFetchResult<T>>;
  cursor?: PaginatorCursorOptions<T, TCursor>;
  maxLimit?: number;
};

/** Auto-walking iteration, shared by every paginator tier. */
export type PaginatorIteration<T> = {
  /**
   * Walk every page from `input` until exhausted, fetching lazily. Cursor
   * inputs follow `endCursor` (or `startCursor` when `direction` is
   * `"backward"`); page/offset inputs advance the offset.
   */
  pages: (input: PaginationInput) => AsyncGenerator<Paginated<T>>;
  /** Like `pages`, but flattened: yields every item across all pages. */
  items: (input: PaginationInput) => AsyncGenerator<T>;
};

/** Paginator from an all-sync configuration: results are plain values. */
export type PaginatorSync<T> = PaginatorIteration<T> & {
  paginate: (input: PaginationInput) => Paginated<T>;
  cursorFor: (item: T) => string;
};

/**
 * Paginator with possibly-async fetchers and a sync codec: `paginate` may
 * return a Promise, but cursor tokens are always synchronous.
 */
export type Paginator<T> = PaginatorIteration<T> & {
  /** Run any pagination request against the configured fetchers. */
  paginate: (input: PaginationInput) => MaybePromise<Paginated<T>>;
  /** Encode the cursor token for an item. Throws without cursor config. */
  cursorFor: (item: T) => string;
};

/** Paginator whose codec has async stages: cursor tokens may be Promises. */
export type PaginatorMaybeAsync<T> = PaginatorIteration<T> & {
  paginate: (input: PaginationInput) => MaybePromise<Paginated<T>>;
  cursorFor: (item: T) => MaybePromise<string>;
};

/**
 * Create a source-agnostic paginator. You provide fetchers for the
 * capabilities your source supports; the paginator normalizes inputs,
 * over-fetches one row to compute `hasNextPage` without a count query,
 * handles backward (scroll-up) pagination, and emits a uniform
 * `Paginated<T>` envelope.
 *
 * Sync/async adaptive: the paginator is as synchronous as what you pass.
 * All-sync fetchers + codec → `paginate` returns a plain `Paginated<T>`;
 * any async piece → it returns a Promise. `await` works on both.
 *
 * @example Drizzle + drizzle-cursor
 * ```ts
 * const cursorGen = generateCursor({ primaryCursor: { key: "id", schema: users.id } });
 *
 * const paginator = createPaginator({
 *   fetchOffset: async ({ limit, offset }) => ({
 *     items: await db.select().from(users).orderBy(asc(users.id)).limit(limit).offset(offset),
 *   }),
 *   fetchCursor: async ({ limit, cursor, direction }) => ({
 *     items: await db.select().from(users)
 *       .where(cursorGen.where(cursor))
 *       .orderBy(...cursorGen.orderBy)
 *       .limit(limit),
 *   }),
 *   cursor: { fromItem: (u) => ({ id: u.id }) },
 *   maxLimit: 100,
 * });
 *
 * await paginator.paginate({ type: "page", page: 2, pageSize: 20 });
 * await paginator.paginate({ type: "cursor", limit: 20, cursor: token, direction: "backward" });
 * ```
 *
 * @example In-memory array — fully synchronous
 * ```ts
 * const paginator = createPaginator({
 *   fetchOffset: ({ limit, offset }) => ({ items: rows.slice(offset, offset + limit) }),
 * });
 * const { items, pageInfo } = paginator.paginate({ type: "page", page: 1, pageSize: 10 }); // no await
 * ```
 *
 * @example Iterating everything — `pages()` / `items()` auto-walk lazily
 * ```ts
 * for await (const page of paginator.pages({ type: "cursor", limit: 100 })) {
 *   await exportBatch(page.items); // one fetch per loop turn
 * }
 *
 * for await (const user of paginator.items({ type: "offset", limit: 50, offset: 0 })) {
 *   // flattened across pages; composes with the iterable utils:
 * }
 * const all = await collect(paginator.items({ type: "cursor", limit: 100 }));
 * ```
 */
export function createPaginator<
  T,
  TCursor extends Record<string, unknown> = Record<string, unknown>,
>(options: CreatePaginatorOptionsSync<T, TCursor>): PaginatorSync<T>;
export function createPaginator<
  T,
  TCursor extends Record<string, unknown> = Record<string, unknown>,
>(options: CreatePaginatorOptions<T, TCursor>): Paginator<T>;
export function createPaginator<
  T,
  TCursor extends Record<string, unknown> = Record<string, unknown>,
>(options: CreatePaginatorOptionsMaybeAsync<T, TCursor>): PaginatorMaybeAsync<T>;
export function createPaginator<
  T,
  TCursor extends Record<string, unknown> = Record<string, unknown>,
>(options: CreatePaginatorOptionsMaybeAsync<T, TCursor>): PaginatorMaybeAsync<T> {
  const { fetchOffset, fetchCursor, cursor, maxLimit } = options;
  const codec: CursorCodecMaybeAsync<TCursor> = cursor?.codec ?? createCursorCodec<TCursor>();

  const clampLimit = (limit: number): number => {
    const truncated = Math.max(1, Math.trunc(limit));
    return maxLimit === undefined ? truncated : Math.min(truncated, maxLimit);
  };

  const cursorFor = (item: T): MaybePromise<string> => {
    if (!cursor) {
      throw new Error("createPaginator: `cursor.fromItem` is required to encode cursors");
    }
    return codec.encode(cursor.fromItem(item));
  };

  /** Encode first/last cursors, staying sync when the codec is sync. */
  const cursorPair = (items: T[]): MaybePromise<[string, string]> => {
    const start = cursorFor(items[0]!);
    const end = cursorFor(items[items.length - 1]!);
    return isPromise(start) || isPromise(end)
      ? Promise.all([start, end])
      : [start as string, end as string];
  };

  const paginateOffset = (input: PagePagination | OffsetPagination): MaybePromise<Paginated<T>> => {
    if (!fetchOffset) {
      throw new Error(
        `createPaginator: "${input.type}" pagination requires a \`fetchOffset\` fetcher`,
      );
    }
    const window = toOffsetWindow(input);
    const limit = clampLimit(window.limit);
    const { offset } = window;

    return chainMaybePromise(
      fetchOffset({ limit: limit + 1, offset }),
      ({ items: fetched, totalItems }) => {
        const items = fetched.slice(0, limit);
        const hasNextPage =
          totalItems === undefined ? fetched.length > limit : offset + items.length < totalItems;

        const pageInfo: PageInfo = {
          hasNextPage,
          hasPreviousPage: offset > 0,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
        };
        if (totalItems !== undefined) {
          pageInfo.totalItems = totalItems;
          pageInfo.totalPages = Math.ceil(totalItems / limit);
        }
        if (cursor && items.length > 0) {
          return chainMaybePromise(cursorPair(items), ([startCursor, endCursor]) => {
            pageInfo.startCursor = startCursor;
            pageInfo.endCursor = endCursor;
            return { items, pageInfo };
          });
        }
        return { items, pageInfo };
      },
    );
  };

  const paginateCursor = (input: CursorPagination): MaybePromise<Paginated<T>> => {
    if (!fetchCursor || !cursor) {
      throw new Error(
        'createPaginator: "cursor" pagination requires a `fetchCursor` fetcher and `cursor` config',
      );
    }
    const direction = input.direction ?? "forward";
    const limit = clampLimit(input.limit);
    const decoded: MaybePromise<TCursor | null> = input.cursor ? codec.decode(input.cursor) : null;

    return chainMaybePromise(decoded, (cursorData) =>
      chainMaybePromise(
        fetchCursor({ limit: limit + 1, cursor: cursorData, direction }),
        ({ items: fetched, totalItems }) => {
          const hasMore = fetched.length > limit;
          const page = fetched.slice(0, limit);
          // backward fetchers return rows in flipped order — restore natural order
          const items = direction === "backward" ? page.reverse() : page;

          const hadCursor = input.cursor != null;
          const pageInfo: PageInfo = {
            hasNextPage: direction === "forward" ? hasMore : hadCursor,
            hasPreviousPage: direction === "backward" ? hasMore : hadCursor,
            startCursor: null,
            endCursor: null,
          };
          if (totalItems !== undefined) {
            pageInfo.totalItems = totalItems;
          }
          if (items.length === 0) {
            return { items, pageInfo };
          }
          return chainMaybePromise(cursorPair(items), ([startCursor, endCursor]) => {
            pageInfo.startCursor = startCursor;
            pageInfo.endCursor = endCursor;
            return { items, pageInfo };
          });
        },
      ),
    );
  };

  const paginate = (input: PaginationInput): MaybePromise<Paginated<T>> =>
    input.type === "cursor" ? paginateCursor(input) : paginateOffset(input);

  /**
   * Lazily walk every page from `input` until exhausted. Two safety stops
   * guard against infinite loops on misbehaving fetchers: an empty page and
   * a cursor that did not advance both end iteration.
   */
  async function* pages(input: PaginationInput): AsyncGenerator<Paginated<T>> {
    let current = input;
    for (;;) {
      const result = await paginate(current);
      yield result;
      if (result.items.length === 0) {
        return;
      }
      if (current.type === "cursor") {
        const direction = current.direction ?? "forward";
        const hasMore =
          direction === "forward" ? result.pageInfo.hasNextPage : result.pageInfo.hasPreviousPage;
        const nextCursor =
          direction === "forward" ? result.pageInfo.endCursor : result.pageInfo.startCursor;
        if (!hasMore || nextCursor == null || nextCursor === current.cursor) {
          return;
        }
        current = { ...current, cursor: nextCursor };
      } else {
        if (!result.pageInfo.hasNextPage) {
          return;
        }
        const window = toOffsetWindow(current);
        current = {
          type: "offset",
          limit: window.limit,
          offset: window.offset + result.items.length,
        };
      }
    }
  }

  async function* items(input: PaginationInput): AsyncGenerator<T> {
    for await (const page of pages(input)) {
      yield* page.items;
    }
  }

  return { paginate, cursorFor, pages, items };
}
