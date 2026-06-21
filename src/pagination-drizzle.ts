import { and, asc, desc, eq, gt, lt, or, type SQL } from "drizzle-orm";
import type { KeysetSortKey, KeysetWhere } from "./keyset.ts";

export type DrizzleKeysetTarget = Parameters<typeof asc>[0];

export type DrizzleKeysetColumns = Record<string, DrizzleKeysetTarget>;

export type DrizzleKeyset = {
  /** Render a portable keyset where AST to Drizzle SQL. `null` means first page. */
  where(where: KeysetWhere | null): SQL | undefined;
  /** Render portable keyset order keys to Drizzle `orderBy(...values)`. */
  orderBy(order: KeysetSortKey[]): SQL[];
};

const resolveColumn = (columns: DrizzleKeysetColumns, key: string): DrizzleKeysetTarget => {
  const col = columns[key];
  if (col === undefined) {
    throw new Error(`toDrizzleKeyset: missing column mapping for key "${key}"`);
  }
  return col;
};

/**
 * Create a Drizzle adapter for portable keyset predicates and ordering.
 *
 * The mapping values can be Drizzle columns or SQL expressions. Keys are the
 * logical cursor keys used by `createKeysetSpec`; they do not need to match
 * database column names.
 *
 * @example
 * ```ts
 * import { toDrizzleKeyset } from "xtandard/pagination/drizzle";
 *
 * const drizzleKeyset = toDrizzleKeyset({
 *   createdAt: posts.createdAt,
 *   id: posts.id,
 * });
 *
 * await db
 *   .select()
 *   .from(posts)
 *   .where(drizzleKeyset.where(keyset.where(cursor, direction)))
 *   .orderBy(...drizzleKeyset.orderBy(keyset.orderBy(direction)))
 *   .limit(limit);
 * ```
 */
export function toDrizzleKeyset(columns: DrizzleKeysetColumns): DrizzleKeyset {
  const where = (keysetWhere: KeysetWhere | null): SQL | undefined => {
    if (keysetWhere == null) {
      return undefined;
    }

    const branches = keysetWhere.or.flatMap((branch) => {
      const predicates = branch.and.map((pred) => {
        const col = resolveColumn(columns, pred.key);
        switch (pred.op) {
          case "eq":
            return eq(col, pred.value);
          case "gt":
            return gt(col, pred.value);
          case "lt":
            return lt(col, pred.value);
        }
      });
      const combined = and(...predicates);
      return combined === undefined ? [] : [combined];
    });

    return or(...branches);
  };

  const orderBy = (order: KeysetSortKey[]): SQL[] =>
    order.map((col) => {
      const target = resolveColumn(columns, col.key);
      return col.order === "asc" ? asc(target) : desc(target);
    });

  return { where, orderBy };
}
