/**
 * Renders the compiled filter AST to a Drizzle relational-query `where` object for `db.query` (no runtime dependency).
 * That is what `db.query.<table>.findMany` accepts, not a `SQL` for `db.select().where()`
 * (that's the sibling `@xtandard/lib/filters/drizzle`). Two flavors:
 *
 * - **RQB v2** (drizzle v1, `db.query`): `where` is a plain object:
 *   `buildWhere` / `buildFilterNode` / `toDrizzleRqbWhere`. Columns are referenced by their
 *   schema property key, so drizzle resolves them against the (aliased) root table itself,
 *   sidestepping the "invalid reference to FROM-clause entry" footgun of raw column SQL.
 * - **RQB v1** (legacy, `db._query` / drizzle 0.x `db.query`): `where` is a callback
 *   `(fields, operators) => SQL`: `buildRqbV1Where` / `buildRqbV1FilterNode` /
 *   `toDrizzleRqbV1Callback`. It builds with the `operators` and `fields` drizzle passes in,
 *   so column refs resolve against the RQB's aliased table too. On a SQLite or MySQL column
 *   (detected from the column), text matches render as `like … escape` instead of `ilike`;
 *   the `array` ops are Postgres `@>`/`<@`/`&&` built with drizzle's `sql` tag.
 *
 * Neither imports `drizzle-orm` (no peer). Operator mapping (1:1 with RQB v2):
 * `eq`/`ne`/`gt`/`gte`/`lt`/`lte`; set → `in`/`notIn`; text match → `like`/`ilike`/`notIlike`
 * (`contains`/`startsWith`/`endsWith` lower to `ilike` with an escaped `%` pattern);
 * `between`/`notBetween` are lowered upstream to `gte`+`lte` / `lt`+`gt`;
 * `isNull`/`isNotNull` → `{ isNull: true }`/`{ isNotNull: true }`; scalar array →
 * `arrayContains`/`arrayContained`/`arrayOverlaps`; tree → `AND`/`OR`/`NOT`.
 *
 * The RQB v2 object's text matches are Postgres-only: a v2 column filter takes a bare
 * pattern (no `ESCAPE`), and drizzle renders its `ilike` key as `ilike`, which SQLite and
 * MySQL don't have. On those databases use the v1 callback or `@xtandard/lib/filters/drizzle`.
 *
 * Import from `@xtandard/lib/filters/drizzle-rqb`.
 *
 * @example
 * ```ts
 * import { buildWhere, textField, dateField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * // `column` is the RQB v2 schema PROPERTY key (e.g. "createdAt"), not the SQL column name.
 * const spec = { name: textField({ column: "name" }), createdAt: dateField({ column: "createdAt" }) };
 * const { where } = buildWhere({ spec, filters, resolveDate });
 * const rows = await db.query.tasks.findMany({ where, limit: 20 });
 * ```
 *
 * @module filters/drizzle-rqb
 */

export * from "./filters/drizzle-rqb.ts";
