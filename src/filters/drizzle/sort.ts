import type { AnyColumn, SQL } from "drizzle-orm";

import { asc, desc } from "drizzle-orm";

import type { Sort } from "../sort.ts";

/**
 * Compile a `Sort` into Drizzle `orderBy` SQL, allow-listed to `columns` (a
 * per-resource map of sortable public field name → column). Unknown fields are
 * dropped; an empty/all-dropped result falls back to `defaultSort`. Pair with a
 * `db.select(...).orderBy(...buildOrderBy(...).orderBy)` — NOT the RQB query
 * (RQB aliases the root table and breaks column-referencing SQL).
 */
export function buildOrderBy(input: {
  sort: Sort;
  columns: Record<string, AnyColumn>;
  defaultSort?: Sort;
}): { orderBy: SQL[] } {
  const resolve = (sort: Sort): SQL[] =>
    sort.flatMap((item) => {
      const column = input.columns[item.field];
      if (!column) return [];

      return [item.dir === "asc" ? asc(column) : desc(column)];
    });

  const ordered = resolve(input.sort);
  if (ordered.length > 0) return { orderBy: ordered };

  return { orderBy: resolve(input.defaultSort ?? []) };
}
