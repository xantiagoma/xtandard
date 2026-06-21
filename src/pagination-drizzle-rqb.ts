import type { KeysetSortKey, KeysetWhere } from "./keyset.ts";

/**
 * Drizzle **RQB v2** keyset adapter — renders the portable keyset AST (from
 * `createKeysetSpec`) to the relational query builder's plain `where` OBJECT and
 * `orderBy` OBJECT for `db.query.<table>.findMany({ where, orderBy, limit })`,
 * NOT a `SQL` for `db.select()` (that's the sibling `@xtandard/lib/pagination/drizzle`
 * `toDrizzleKeyset`).
 *
 * **No driver dependency** — emits plain objects drizzle interprets (no
 * `drizzle-orm` import, no peer). Column keys are the RQBv2 schema PROPERTY keys.
 *
 * @example
 * ```ts
 * import { createKeysetSpec } from "@xtandard/lib/pagination";
 * import { toDrizzleRqbKeyset } from "@xtandard/lib/pagination/drizzle-rqb";
 *
 * const keyset = createKeysetSpec({ sort: [{ key: "createdAt", order: "desc" }, { key: "id", order: "asc" }] });
 * const rqb = toDrizzleRqbKeyset({ createdAt: "createdAt", id: "id" });
 *
 * const rows = await db.query.posts.findMany({
 *   where: rqb.where(keyset.where(cursor, direction)),   // undefined = first page
 *   orderBy: rqb.orderBy(keyset.orderBy(direction)),
 *   limit,
 * });
 * ```
 */

/** A single column's RQBv2 keyset condition (`{ eq | gt | lt: value }`). */
export type RqbKeysetCondition = { eq: unknown } | { gt: unknown } | { lt: unknown };

/** The RQBv2 `where` shape this keyset emits: an `OR` of `AND`ed column seeks. */
export type RqbKeysetWhere = {
  OR: { AND: Record<string, RqbKeysetCondition>[] }[];
};

export type DrizzleRqbKeyset = {
  /** Render a portable keyset where AST to an RQBv2 `where` object. `null` → first page (undefined). */
  where(where: KeysetWhere | null): RqbKeysetWhere | undefined;
  /** Render portable keyset order keys to an RQBv2 `orderBy` object (insertion-ordered). */
  orderBy(order: KeysetSortKey[]): Record<string, "asc" | "desc">;
};

const resolveColumn = (columns: Record<string, string>, key: string): string => {
  const col = columns[key];
  if (col === undefined) {
    throw new Error(`toDrizzleRqbKeyset: missing column mapping for key "${key}"`);
  }

  return col;
};

const predicate = (op: "eq" | "gt" | "lt", value: unknown): RqbKeysetCondition => {
  if (op === "eq") return { eq: value };
  if (op === "gt") return { gt: value };

  return { lt: value };
};

/**
 * Create an RQBv2 adapter for portable keyset predicates and ordering. `columns`
 * maps logical cursor keys (from `createKeysetSpec`) to RQBv2 schema property
 * keys; they need not match database column names.
 */
export function toDrizzleRqbKeyset(columns: Record<string, string>): DrizzleRqbKeyset {
  const where = (keysetWhere: KeysetWhere | null): RqbKeysetWhere | undefined => {
    if (keysetWhere == null) return undefined;

    const or = keysetWhere.or.map((branch) => {
      const and = branch.and.map((pred) => ({
        [resolveColumn(columns, pred.key)]: predicate(pred.op, pred.value),
      }));

      return { AND: and };
    });

    return { OR: or };
  };

  const orderBy = (order: KeysetSortKey[]): Record<string, "asc" | "desc"> => {
    const out: Record<string, "asc" | "desc"> = {};
    for (const col of order) out[resolveColumn(columns, col.key)] = col.order;

    return out;
  };

  return { where, orderBy };
}

// ── RQB v1 (legacy `where`/`orderBy` callbacks) ──────────────────────────────

/** The operators the RQB **v1** `where` callback needs for a keyset seek. */
export interface RqbV1KeysetOperators<R> {
  eq(column: unknown, value: unknown): R;
  gt(column: unknown, value: unknown): R;
  lt(column: unknown, value: unknown): R;
  and(...conditions: (R | undefined)[]): R | undefined;
  or(...conditions: (R | undefined)[]): R | undefined;
}

/** The operators the RQB **v1** `orderBy` callback needs (`asc`/`desc`). */
export interface RqbV1OrderOperators<R> {
  asc(column: unknown): R;
  desc(column: unknown): R;
}

export type DrizzleRqbV1Keyset = {
  /** A keyset where AST → an RQB v1 `where` callback (`null` → first page, no callback). */
  where(
    where: KeysetWhere | null,
  ):
    | (<R>(fields: Record<string, unknown>, operators: RqbV1KeysetOperators<R>) => R | undefined)
    | undefined;
  /** Keyset order keys → an RQB v1 `orderBy` callback returning ordered `asc`/`desc` SQL. */
  orderBy(
    order: KeysetSortKey[],
  ): <R>(fields: Record<string, unknown>, operators: RqbV1OrderOperators<R>) => R[];
};

/**
 * RQB **v1** keyset adapter — renders the keyset AST to drizzle v1's legacy
 * `where`/`orderBy` CALLBACKS (`(fields, operators) => …`), building via the
 * provided operators/fields (no raw-SQL alias footgun). Driver-free.
 */
export function toDrizzleRqbV1Keyset(columns: Record<string, string>): DrizzleRqbV1Keyset {
  const where = (keysetWhere: KeysetWhere | null) => {
    if (keysetWhere == null) return undefined;

    return <R>(fields: Record<string, unknown>, ops: RqbV1KeysetOperators<R>): R | undefined => {
      const branches = keysetWhere.or
        .map((branch) => {
          const terms = branch.and.map((pred) => {
            const column = fields[resolveColumn(columns, pred.key)];
            if (pred.op === "eq") return ops.eq(column, pred.value);
            if (pred.op === "gt") return ops.gt(column, pred.value);

            return ops.lt(column, pred.value);
          });

          return ops.and(...terms);
        })
        .filter((b): b is R => b !== undefined);

      return ops.or(...branches);
    };
  };

  const orderBy =
    (order: KeysetSortKey[]) =>
    <R>(fields: Record<string, unknown>, ops: RqbV1OrderOperators<R>): R[] =>
      order.map((col) => {
        const column = fields[resolveColumn(columns, col.key)];

        return col.order === "asc" ? ops.asc(column) : ops.desc(column);
      });

  return { where, orderBy };
}
