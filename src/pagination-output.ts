import type { CursorDirection, PageInfo, Paginated, PaginatorMaybeAsync } from "./pagination.ts";

/** A GraphQL connection, per the Relay Cursor Connections spec. */
export type RelayConnection<T> = {
  edges: Array<{ node: T; cursor: string | null }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
};

/**
 * Shape a `Paginated<T>` result as a Relay connection. Pass the paginator's
 * `cursorFor` so every edge gets its own cursor; without it only
 * `pageInfo.startCursor`/`endCursor` are populated.
 *
 * @example
 * ```ts
 * const result = await paginator.paginate(fromRelayArgs(args));
 * return toRelayConnection(result, paginator.cursorFor);
 * ```
 */
export function toRelayConnection<T>(
  result: Paginated<T>,
  cursorFor?: (item: T, index: number) => string,
): RelayConnection<T> {
  return {
    edges: result.items.map((node, index) => ({
      node,
      cursor: cursorFor ? cursorFor(node, index) : null,
    })),
    pageInfo: {
      hasNextPage: result.pageInfo.hasNextPage,
      hasPreviousPage: result.pageInfo.hasPreviousPage,
      startCursor: result.pageInfo.startCursor ?? null,
      endCursor: result.pageInfo.endCursor ?? null,
    },
  };
}

/** A typical REST list response: items under `data`, pagination under `meta`. */
export type RestEnvelope<T> = { data: T[]; meta: PageInfo };

/**
 * Shape a `Paginated<T>` result as a REST envelope.
 *
 * @example
 * ```ts
 * const result = await paginator.paginate(parsePaginationParams(url.searchParams));
 * return Response.json(toRestEnvelope(result));
 * ```
 */
export function toRestEnvelope<T>(result: Paginated<T>): RestEnvelope<T> {
  return { data: result.items, meta: result.pageInfo };
}

export type InfinitePaginationOptions<T> = {
  initialPageParam: string | null;
  queryFn: (context: {
    pageParam?: string | null;
    direction?: CursorDirection;
  }) => Promise<Paginated<T>>;
  getNextPageParam: (lastPage: Paginated<T>) => string | undefined;
  getPreviousPageParam: (firstPage: Paginated<T>) => string | undefined;
};

/**
 * Build the cursor-walking config fragment for TanStack Query's
 * `useInfiniteQuery` (v5). Plain object factory — no dependency on
 * `@tanstack/react-query`, so it lives in the zero-dep core and works with
 * the React, Vue, Solid and Svelte adapters alike.
 *
 * @example
 * ```ts
 * useInfiniteQuery({
 *   queryKey: ["users"],
 *   ...infinitePaginationOptions(userPaginator, { pageSize: 20 }),
 * });
 * ```
 */
export function infinitePaginationOptions<T>(
  paginator: PaginatorMaybeAsync<T>,
  options: { pageSize?: number } = {},
): InfinitePaginationOptions<T> {
  const limit = options.pageSize ?? 20;
  return {
    initialPageParam: null,
    queryFn: ({ pageParam, direction }) =>
      Promise.resolve(
        paginator.paginate({
          type: "cursor",
          limit,
          cursor: pageParam ?? undefined,
          direction: direction ?? "forward",
        }),
      ),
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? (lastPage.pageInfo.endCursor ?? undefined) : undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage.pageInfo.hasPreviousPage
        ? (firstPage.pageInfo.startCursor ?? undefined)
        : undefined,
  };
}
