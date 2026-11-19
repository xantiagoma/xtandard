/**
 * Renders the compiled filter AST to raw parameterized SQL for Knex (no driver dependency).
 * `applyFiltersToKnex` applies it via `whereRaw`; `buildWhereSql` returns the `{ sql, bindings }`.
 *
 * **Dialect-aware** (`dialect`, default `"postgres"`): the `array` ops and `ILIKE` are spelled
 * per dialect: PG native `@>`/`<@`/`&&` + `ILIKE`, MySQL `JSON_CONTAINS`/`JSON_OVERLAPS` +
 * `LIKE`, SQLite `json_each(…)` subqueries + `LIKE` (see {@link SqlDialect}). On MySQL/SQLite,
 * `LIKE` gets an `ESCAPE` clause so the escaped `%`/`_`/`\` in `contains`/`startsWith`/
 * `endsWith` match literally, and MySQL identifiers are quoted with backticks. There is no
 * `knex` import: any object with `whereRaw(sql, bindings)` works, so Knex stays your app's
 * dependency. Column identifiers are server-owned and validated; values are bound (`?`).
 *
 * Import from `@xtandard/lib/filters/knex`.
 *
 * @example
 * ```ts
 * import { applyFiltersToKnex, textField, numberField } from "@xtandard/lib/filters/knex";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const rows = await applyFiltersToKnex(knex("tasks"), { spec, filters, resolveDate });
 * // or: const { sql, bindings } = buildWhereSql({ spec, filters }) ?? {}; query.whereRaw(sql, bindings);
 * ```
 *
 * @module filters/knex
 */

export * from "./filters/knex.ts";
