import type { KeysetSortKey, KeysetWhere } from "./keyset.ts";
import {
  type SqlTag,
  type SqlTagFragment,
  type SqlTagTarget,
  sqlTagJoin,
  sqlTagRef,
} from "./sql-tag.ts";

/** Logical keyset key → {@link SqlTagTarget} (a column string or a fragment of your `sql`). */
export type SqlTagKeysetColumns = Record<string, SqlTagTarget>;

/** Keyset renderers bound to one `sql` tag; see {@link toSqlTagKeyset}. */
export type SqlTagKeyset<F> = {
  /** Render a portable keyset where AST to a fragment (`undefined` on the first page). */
  where(where: KeysetWhere | null): F | undefined;
  /** Render portable keyset order keys to ONE comma-separated fragment for `order by`. */
  orderBy(order: KeysetSortKey[]): F;
};

const resolveColumn = (sql: SqlTag, columns: SqlTagKeysetColumns, key: string): unknown => {
  const col = columns[key];
  if (col === undefined) {
    throw new Error(`toSqlTagKeyset: missing column mapping for key "${key}"`);
  }
  return sqlTagRef(sql, col, "toSqlTagKeyset");
};

const predicateSql = (sql: SqlTag, col: unknown, op: "eq" | "gt" | "lt", value: unknown) => {
  switch (op) {
    case "eq":
      return sql`${col} = ${value}`;
    case "gt":
      return sql`${col} > ${value}`;
    case "lt":
      return sql`${col} < ${value}`;
  }
};

/**
 * Create a keyset adapter for a tagged-template SQL client (postgres.js, or Bun.sql on any of
 * its adapters): portable keyset predicates and ordering rendered as fragments of your `sql`,
 * to embed in your own query. Cursor values are always parameters.
 *
 * Column strings (`"created_at"`, `"posts.created_at"`) must be server-owned; they're validated
 * and quoted by `sql(identifier)`. For computed sort keys, pass a fragment from your `sql` tag.
 *
 * @example
 * ```ts
 * import postgres from "postgres"; // or: import { sql } from "bun";
 * import { createKeysetSpec } from "@xtandard/lib/pagination";
 * import { toSqlTagKeyset } from "@xtandard/lib/pagination/sql-tag";
 *
 * const sql = postgres(process.env.DATABASE_URL);
 * const keyset = createKeysetSpec({ sort: [{ key: "createdAt", order: "desc" }, { key: "id", order: "desc" }] });
 * const posts = toSqlTagKeyset(sql, { createdAt: "posts.created_at", id: "posts.id" });
 *
 * const where = posts.where(keyset.where(cursor, direction));
 * const rows = await sql`
 *   select * from posts
 *   ${where ? sql`where ${where}` : sql``}
 *   order by ${posts.orderBy(keyset.orderBy(direction))}
 *   limit ${limit}
 * `;
 * // where (("posts"."created_at" < $1) OR ("posts"."created_at" = $2 AND "posts"."id" < $3))
 * // order by "posts"."created_at" DESC, "posts"."id" DESC limit $4
 * ```
 *
 * @throws When a key has no column mapping or a column string isn't a plain identifier.
 */
export function toSqlTagKeyset<S extends SqlTag>(
  sql: S,
  columns: SqlTagKeysetColumns,
): SqlTagKeyset<SqlTagFragment<S>> {
  const where = (keysetWhere: KeysetWhere | null) => {
    if (keysetWhere == null) {
      return undefined;
    }

    const branches = keysetWhere.or.map((branch) => {
      const predicates = branch.and.map((pred) =>
        predicateSql(sql, resolveColumn(sql, columns, pred.key), pred.op, pred.value),
      );
      return sql`(${sqlTagJoin(sql, predicates, "and")})`;
    });

    return sql`(${sqlTagJoin(sql, branches, "or")})` as SqlTagFragment<S>;
  };

  const orderBy = (order: KeysetSortKey[]) =>
    sqlTagJoin(
      sql,
      order.map((col) => {
        const target = resolveColumn(sql, columns, col.key);
        return col.order === "asc" ? sql`${target} ASC` : sql`${target} DESC`;
      }),
      "comma",
    ) as SqlTagFragment<S>;

  return { where, orderBy };
}
