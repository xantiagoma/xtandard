/**
 * Renders the compiled filter AST to fragments of a tagged-template SQL client:
 * **postgres.js** (`postgres(…)`, its transactions and reserved connections) and **Bun.sql**
 * (`sql` / `new SQL(…)`, on Postgres, MySQL/MariaDB or SQLite). You pass your `sql`; the
 * result is a fragment you embed: `` sql`select * from t where ${where}` ``.
 *
 * Every value is a parameter and every keyword is fixed template text (never `sql.unsafe`);
 * column strings are server-owned, validated (`col` / `table.col`) and quoted by your client's
 * `sql(identifier)`. There is no driver import: anything matching the structural {@link SqlTag}
 * works. **Dialect-aware** (`dialect`, default `"postgres"`; `"mysql"`/`"sqlite"` for Bun.sql's
 * other adapters): the `array` ops, `ILIKE` and the `LIKE` escape clause are spelled per dialect
 * (see {@link SqlDialect}).
 *
 * The fragments are lazy queries (thenables): embed them, never `await` them on their own.
 *
 * Import from `@xtandard/lib/filters/sql-tag`.
 *
 * @example
 * ```ts
 * import postgres from "postgres"; // or: import { sql } from "bun";
 * import { buildOrderBy, buildWhere, numberField, textField } from "@xtandard/lib/filters/sql-tag";
 *
 * const sql = postgres(process.env.DATABASE_URL);
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const { where } = buildWhere({ sql, spec, filters, resolveDate });
 * const { orderBy } = buildOrderBy({ sql, sort, columns: { name: "name", amount: "amount" } });
 * const rows = await sql`
 *   select * from tasks
 *   ${where ? sql`where ${where}` : sql``}
 *   order by ${orderBy ?? sql`id`}
 * `;
 * ```
 *
 * @module filters/sql-tag
 */

export * from "./filters/sql-tag.ts";
