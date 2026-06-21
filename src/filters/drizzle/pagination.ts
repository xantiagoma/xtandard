import type { AnyColumn, SQL } from "drizzle-orm";
import type { CursorDirection, KeysetSortColumn, KeysetWhere } from "../../entry-pagination.ts";

import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
import { createKeysetSpec, createPaginator } from "../../entry-pagination.ts";

/**
 * The Drizzle keyset bridge for cursor pagination. We use the PORTABLE
 * `createKeysetSpec` (drizzle-free — it emits a small `{ or: [{ and: [...] }] }`
 * predicate AST) and render it to Drizzle `SQL` here. We deliberately do NOT use
 * `xantiagoma/pagination/drizzle` (`toDrizzleKeyset`): its optional `drizzle-orm`
 * peer is pinned `^0.45`, which can pull a SECOND drizzle-orm copy and collide
 * with a `1.0.0-beta` install. `combineWhere` ANDs the filter WHERE with the
 * keyset seek. Offset/page pagination needs none of this.
 */

export { createPaginator };

function isSql(value: SQL | undefined): value is SQL {
  return value !== undefined;
}

/** AND together any defined conditions (filter WHERE + keyset seek). */
export function combineWhere(...conditions: (SQL | undefined)[]): SQL | undefined {
  const defined = conditions.filter(isSql);

  return defined.length > 0 ? and(...defined) : undefined;
}

export interface DrizzleKeyset {
  /** Logical cursor keys, in sort order — use to build `cursor.fromItem`. */
  keys: () => string[];
  /** `orderBy(...)` SQL for a fetch direction (backward flips, paginator restores). */
  orderBy: (direction?: CursorDirection) => SQL[];
  /** Lexicographic seek `WHERE` for a decoded cursor (`null` cursor → first page). */
  where: (
    cursor: Record<string, unknown> | null | undefined,
    direction?: CursorDirection,
  ) => SQL | undefined;
}

/**
 * Build a keyset (cursor) helper from a sort spec + the Drizzle columns each
 * logical key maps to. The last sort column MUST be unique (a tiebreaker like
 * `id`) so the cursor is stable.
 */
export function createDrizzleKeyset(input: {
  sort: KeysetSortColumn[];
  columns: Record<string, AnyColumn>;
}): DrizzleKeyset {
  const spec = createKeysetSpec({ sort: input.sort });
  const columns = input.columns;

  const seekToSql = (where: KeysetWhere | null): SQL | undefined => {
    if (!where) return undefined;

    const clauses = where.or
      .map((clause) => {
        const predicates = clause.and
          .map((p) => {
            const column = columns[p.key];
            if (!column) return undefined;

            return p.op === "eq"
              ? eq(column, p.value)
              : p.op === "gt"
                ? gt(column, p.value)
                : lt(column, p.value);
          })
          .filter(isSql);

        return predicates.length > 0 ? and(...predicates) : undefined;
      })
      .filter(isSql);

    return clauses.length > 0 ? or(...clauses) : undefined;
  };

  return {
    keys: () => spec.keys(),
    orderBy: (direction) =>
      spec.orderBy(direction).flatMap((key) => {
        const column = columns[key.key];
        if (!column) return [];

        return [key.order === "asc" ? asc(column) : desc(column)];
      }),
    where: (cursor, direction) => seekToSql(spec.where(cursor, direction)),
  };
}
