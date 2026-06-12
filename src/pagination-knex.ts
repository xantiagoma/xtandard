import type { KeysetSortKey, KeysetSqlColumns, KeysetWhere, ToKeysetSqlOptions } from "./keyset.ts";
import { toKeysetOrderBySql, toKeysetWhereSql } from "./keyset.ts";

/**
 * Minimal structural subset of a Knex query builder used by
 * {@link applyKeysetToKnex}.
 *
 * `xantiagoma/pagination/knex` does not import `knex`; any object with these
 * methods works, which keeps Knex as your application's dependency rather than
 * a peer dependency of this package.
 */
export type KnexKeysetQuery = {
  /** Apply a raw `WHERE` clause with bind parameters. */
  whereRaw(sql: string, bindings?: unknown[]): unknown;
  /** Apply a raw `ORDER BY` clause. */
  orderByRaw(sql: string): unknown;
};

/** Options for {@link applyKeysetToKnex}. */
export type ApplyKeysetToKnexOptions = ToKeysetSqlOptions & {
  /** Logical key → SQL identifier/expression. Must be server-owned, not request data. */
  columns: KeysetSqlColumns;
};

/**
 * Apply a portable keyset `WHERE` + `ORDER BY` to a Knex query builder.
 * Values are passed as bindings; column identifiers are validated by the raw
 * SQL helpers before being rendered.
 *
 * This mutates and returns the provided Knex query builder, matching Knex's
 * chaining style. For first-page cursor requests (`where === null`), it skips
 * `whereRaw` and only applies `orderByRaw`.
 *
 * @example
 * ```ts
 * import { createKeysetSpec } from "xantiagoma/pagination";
 * import { applyKeysetToKnex } from "xantiagoma/pagination/knex";
 *
 * const keyset = createKeysetSpec({
 *   sort: [
 *     { key: "createdAt", order: "asc" },
 *     { key: "id", order: "asc" },
 *   ],
 * });
 *
 * const q = applyKeysetToKnex(
 *   knex("posts").select("*"),
 *   keyset.where(cursor, direction),
 *   keyset.orderBy(direction),
 *   { columns: { createdAt: "created_at", id: "id" } },
 * );
 *
 * const rows = await q.limit(limit);
 * ```
 *
 * @throws If `options.columns` is missing a key or contains an unsafe SQL
 * identifier.
 */
export function applyKeysetToKnex<TQuery extends KnexKeysetQuery>(
  query: TQuery,
  where: KeysetWhere | null,
  order: KeysetSortKey[],
  options: ApplyKeysetToKnexOptions,
): TQuery {
  const whereSql = toKeysetWhereSql(where, options.columns, {
    paramStart: options.paramStart,
    placeholder: options.placeholder ?? (() => "?"),
  });
  if (whereSql.sql) {
    query.whereRaw(whereSql.sql, whereSql.params);
  }
  query.orderByRaw(toKeysetOrderBySql(order, options.columns));
  return query;
}
