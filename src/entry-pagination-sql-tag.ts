/**
 * Keyset adapter for tagged-template SQL clients (postgres.js, Bun.sql): portable keyset
 * predicates and ordering as fragments of your `sql`, with no driver dependency.
 *
 * Import from `@xtandard/lib/pagination/sql-tag`.
 *
 * @module pagination/sql-tag
 */

export { toSqlTagKeyset } from "./pagination-sql-tag.ts";
export type { SqlTagKeyset, SqlTagKeysetColumns } from "./pagination-sql-tag.ts";
export type { SqlTag, SqlTagFragment, SqlTagTarget } from "./sql-tag.ts";
