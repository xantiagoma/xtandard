import { sql, type RawBuilder, type SqlBool } from "kysely";
import type { KeysetSortKey, KeysetWhere } from "./keyset.ts";

export type KyselyKeysetTarget = string | RawBuilder<unknown>;

export type KyselyKeysetColumns = Record<string, KyselyKeysetTarget>;

export type KyselyKeyset = {
  /** Render a portable keyset where AST to a Kysely raw boolean expression. */
  where(where: KeysetWhere | null): RawBuilder<SqlBool> | undefined;
  /** Render portable keyset order keys to expressions accepted by Kysely `orderBy`. */
  orderBy(order: KeysetSortKey[]): RawBuilder<unknown>[];
};

const resolveColumn = (columns: KyselyKeysetColumns, key: string): RawBuilder<unknown> => {
  const col = columns[key];
  if (col === undefined) {
    throw new Error(`toKyselyKeyset: missing column mapping for key "${key}"`);
  }
  return typeof col === "string" ? sql.ref(col) : col;
};

const predicateSql = (
  col: RawBuilder<unknown>,
  op: "eq" | "gt" | "lt",
  value: unknown,
): RawBuilder<SqlBool> => {
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
 * Create a Kysely adapter for portable keyset predicates and ordering.
 *
 * String mappings are passed to `sql.ref`, so they must be server-owned column
 * references such as `posts.created_at`. Computed values should use Kysely's
 * `sql` tag and be passed as `RawBuilder`s.
 *
 * @example
 * ```ts
 * import { sql } from "kysely";
 * import { toKyselyKeyset } from "@xtandard/lib/pagination/kysely";
 *
 * const kyselyKeyset = toKyselyKeyset({
 *   createdAt: "posts.created_at",
 *   id: "posts.id",
 *   normalizedName: sql<string>`upper(first_name || ' ' || last_name)`,
 * });
 *
 * let q = db.selectFrom("posts").selectAll();
 * const where = kyselyKeyset.where(keyset.where(cursor, direction));
 * if (where) q = q.where(where);
 * for (const order of kyselyKeyset.orderBy(keyset.orderBy(direction))) {
 *   q = q.orderBy(order);
 * }
 * ```
 */
export function toKyselyKeyset(columns: KyselyKeysetColumns): KyselyKeyset {
  const where = (keysetWhere: KeysetWhere | null): RawBuilder<SqlBool> | undefined => {
    if (keysetWhere == null) {
      return undefined;
    }

    const branches = keysetWhere.or.map((branch) => {
      const predicates = branch.and.map((pred) =>
        predicateSql(resolveColumn(columns, pred.key), pred.op, pred.value),
      );
      return sql<SqlBool>`(${sql.join(predicates, sql` and `)})`;
    });

    return sql<SqlBool>`(${sql.join(branches, sql` or `)})`;
  };

  const orderBy = (order: KeysetSortKey[]): RawBuilder<unknown>[] =>
    order.map((col) => {
      const target = resolveColumn(columns, col.key);
      return col.order === "asc" ? sql`${target} asc` : sql`${target} desc`;
    });

  return { where, orderBy };
}
