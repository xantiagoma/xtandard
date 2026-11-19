// Internal (not re-exported): the SQL dialect of a Drizzle column and the text-match
// rendering that depends on it. No drizzle-orm import, so the driver-free drizzle-rqb
// adapter can share it.

import { sqlTextOp } from "../compile.ts";

type TextOp = "contains" | "startsWith" | "endsWith" | "like" | "ilike" | "notIlike";

/** A drizzle `sql`-style tagged template. */
type SqlTag<R> = (strings: TemplateStringsArray, ...params: unknown[]) => R;

const ENTITY_KIND = Symbol.for("drizzle:entityKind");

/**
 * The dialect of a Drizzle column, read from its class's `entityKind` (the marker drizzle's
 * own `is()` walks): SQLite and MySQL columns are recognized, anything else (Postgres, Gel,
 * SingleStore, a non-column) keeps the Postgres rendering.
 */
export function drizzleColumnDialect(column: unknown): "postgres" | "mysql" | "sqlite" {
  if (typeof column !== "object" || column === null) return "postgres";

  let cls: unknown = Object.getPrototypeOf(column)?.constructor;
  while (typeof cls === "function") {
    const kind = (cls as unknown as Record<symbol, unknown>)[ENTITY_KIND];
    if (kind === "SQLiteColumn") return "sqlite";
    if (kind === "MySqlColumn") return "mysql";
    cls = Object.getPrototypeOf(cls);
  }

  return "postgres";
}

/**
 * Render a text-match op for a SQLite or MySQL column with `sqlTag`. `ilike` folds to `like`
 * (SQLite and MySQL have no `ilike`; both compare case-insensitively by default). The
 * `escapeLike` backslash needs an ESCAPE clause: SQLite has no default escape character, and
 * MySQL drops its default under NO_BACKSLASH_ESCAPES. `char(92)` is `\` in every MySQL
 * sql_mode, where a '\\' literal changes meaning. Returns `undefined` for a Postgres column:
 * there `\` is already the default escape and the caller keeps drizzle's own operators.
 */
export function drizzleTextSql<R>(
  sqlTag: SqlTag<R>,
  column: unknown,
  op: TextOp,
  value: string,
): R | undefined {
  const dialect = drizzleColumnDialect(column);
  if (dialect === "postgres") return undefined;

  const { op: likeOp, pattern } = sqlTextOp(op, value);
  const negated = likeOp === "notIlike";

  if (dialect === "sqlite") {
    return negated
      ? sqlTag`${column} not like ${pattern} escape '\\'`
      : sqlTag`${column} like ${pattern} escape '\\'`;
  }

  return negated
    ? sqlTag`${column} not like ${pattern} escape char(92)`
    : sqlTag`${column} like ${pattern} escape char(92)`;
}
