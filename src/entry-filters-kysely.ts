/**
 * Renders the compiled filter AST to a Kysely boolean expression (peer `kysely`).
 * Validation-library-free.
 *
 * **Dialect-aware** (`dialect`, default `"postgres"`): the `array` ops and `ilike` are spelled
 * per dialect: PG native `@>`/`<@`/`&&` + `ILIKE`, MySQL `JSON_CONTAINS`/`JSON_OVERLAPS` +
 * `LIKE`, SQLite `json_each(…)` subqueries + `LIKE` (see {@link SqlDialect}). On MySQL/SQLite,
 * `like` gets an `escape` clause so the escaped `%`/`_`/`\` in `contains`/`startsWith`/
 * `endsWith` match literally. String columns
 * are passed to `sql.ref` (server-owned identifiers); computed values use the `sql` tag.
 *
 * Import from `@xtandard/lib/filters/kysely`.
 *
 * @example
 * ```ts
 * import { buildWhere, buildOrderBy, textField, dateField } from "@xtandard/lib/filters/kysely";
 *
 * const spec = { name: textField({ column: "posts.name" }), createdAt: dateField({ column: "posts.created_at" }) };
 * const { where } = buildWhere({ spec, filters, resolveDate });
 * let q = db.selectFrom("posts").selectAll();
 * if (where) q = q.where(where);
 * for (const o of buildOrderBy({ sort, columns: { name: "posts.name" } }).orderBy) q = q.orderBy(o);
 * ```
 *
 * @module filters/kysely
 */

export * from "./filters/kysely.ts";
