/**
 * Pagination primitives, re-exported from `@xtandard/lib/pagination` so the filter
 * surface is one import. These are PURE (no drizzle) — safe on the frontend:
 * `parsePaginationParams` normalizes + clamps untrusted query params into a
 * `PaginationInput`, `fromRelayArgs` does the same for GraphQL connection args,
 * and the envelope/infinite helpers shape results. The Drizzle keyset bridge
 * lives in `@xtandard/lib/filters/drizzle`.
 */
export {
  fromRelayArgs,
  infinitePaginationOptions,
  parsePaginationParams,
  toRelayConnection,
  toRestEnvelope,
} from "../entry-pagination.ts";

export type {
  CursorPagination,
  OffsetPagination,
  PageInfo,
  Paginated,
  PagePagination,
  PaginationInput,
  PaginationParamsSource,
  RelayArgs,
  RelayConnection,
  RestEnvelope,
} from "../entry-pagination.ts";
