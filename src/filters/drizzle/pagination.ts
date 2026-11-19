import type { AnyColumn, SQL } from "drizzle-orm";
import type { CursorDirection, KeysetSortColumn, KeysetWhere } from "../../entry-pagination.ts";

import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
import { createKeysetSpec, createPaginator } from "../../entry-pagination.ts";

/**
 * The Drizzle keyset bridge for cursor pagination. We use the PORTABLE
 * `createKeysetSpec` (drizzle-free — it emits a small `{ or: [{ and: [...] }] }`
 * predicate AST) and render it to Drizzle `SQL` here. We deliberately do NOT use
 * `@xtandard/lib/pagination/drizzle` (`toDrizzleKeyset`): its optional `drizzle-orm`
 * peer is pinned `^0.45`, which can pull a SECOND drizzle-orm copy and collide
 * with a `1.0.0-beta` install. `combineWhere` ANDs the filter WHERE with the
 * keyset seek. Offset/page pagination needs none of this.
 */

export { createPaginator };

function isSql(value: SQL | undefined): value is SQL {
  return value !== undefined;
}

/**
 * AND together the defined conditions, skipping `undefined` ones: typically the filter
 * `WHERE` from `buildWhere` and the keyset seek from `createDrizzleKeyset().where(...)`, which
 * is `undefined` on the first page. Returns `undefined` when every input is `undefined`.
 *
 * @example
 * ```ts
 * import { integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { buildWhere, combineWhere, createDrizzleKeyset, numberField } from "@xtandard/lib/filters/drizzle";
 *
 * const posts = pgTable("posts", { id: text("id").primaryKey(), views: integer("views") });
 * const { where: filterWhere } = buildWhere({
 *   spec: { views: numberField({ column: posts.views }) },
 *   filters: [{ field: "views", filter: { kind: "number", operator: "gte", value: 100 } }],
 * });
 * const keyset = createDrizzleKeyset({ sort: [{ key: "id", order: "asc" }], columns: { id: posts.id } });
 * const where = combineWhere(filterWhere, keyset.where({ id: "p_9" }));
 * const { sql, params } = new PgDialect().sqlToQuery(where!);
 * // sql → '("posts"."views" >= $1 and "posts"."id" > $2)', params → [100, "p_9"]
 * combineWhere(undefined, undefined); // → undefined
 * ```
 */
export function combineWhere(...conditions: (SQL | undefined)[]): SQL | undefined {
  const defined = conditions.filter(isSql);

  return defined.length > 0 ? and(...defined) : undefined;
}

/** The keyset helper returned by {@link createDrizzleKeyset}. */
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
 *
 * `orderBy(direction)` gives the `ORDER BY` for a fetch (`"backward"` flips every column) and
 * `where(cursor, direction)` the lexicographic seek after (or before) the cursor row, or
 * `undefined` for a `null` cursor (the first page). Sort keys without a column in `columns`
 * are skipped.
 *
 * @example
 * ```ts
 * import { PgDialect, pgTable, text, timestamp } from "drizzle-orm/pg-core";
 * import { createDrizzleKeyset } from "@xtandard/lib/filters/drizzle";
 *
 * const posts = pgTable("posts", { id: text("id").primaryKey(), createdAt: timestamp("created_at", { mode: "date" }) });
 * const keyset = createDrizzleKeyset({
 *   sort: [{ key: "createdAt", order: "desc" }, { key: "id", order: "desc" }], // unique tiebreaker last
 *   columns: { createdAt: posts.createdAt, id: posts.id },
 * });
 * const dialect = new PgDialect();
 * keyset.orderBy().map((o) => dialect.sqlToQuery(o).sql); // → ['"posts"."created_at" desc', '"posts"."id" desc']
 * keyset.where(null); // → undefined (first page)
 * const seek = keyset.where({ createdAt: new Date("2026-06-18T00:00:00Z"), id: "p_9" });
 * dialect.sqlToQuery(seek!).sql;
 * // → '("posts"."created_at" < $1 or ("posts"."created_at" = $2 and "posts"."id" < $3))'
 * // in an app: db.select().from(posts).where(seek).orderBy(...keyset.orderBy()).limit(21)
 * ```
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
