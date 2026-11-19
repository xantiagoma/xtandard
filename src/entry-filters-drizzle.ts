/**
 * Renders the compiled filter AST to a Drizzle `WHERE` expression, plus keyset helpers (peer `drizzle-orm`).
 *
 * The SQL dialect comes from the spec's columns: on a SQLite or MySQL column, text matches
 * render as `like … escape` (those databases have no `ilike`, and the `ESCAPE` clause makes
 * the escaped `%`/`_`/`\` match literally); Postgres keeps drizzle's `ilike`. The `array` ops
 * are Postgres-only.
 *
 * Import from `@xtandard/lib/filters/drizzle`.
 *
 * @module filters/drizzle
 */

export * from "./filters/drizzle/index.ts";
