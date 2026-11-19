import type { AnyColumn } from "drizzle-orm";

/**
 * The per-resource filter ALLOW-LIST. Clients send public field names; the spec
 * maps each allowed field to its Drizzle column + data kind. Anything not in the
 * spec is dropped (never trust client-supplied column access).
 *
 * `ColumnOf<TData>` constrains a column by its SELECT data type, so the field
 * constructors (`dateField`/`textField`/…) make a kind↔column-type MISMATCH a
 * COMPILE error at spec construction — the where-builder then needs no casts.
 */

export type ColumnOf<TData> = AnyColumn<{ data: TData }>;

/** One allow-listed field: its filter kind plus the Drizzle column it reads. Build it with
 * `textField`/`numberField`/`dateField`/`enumField`/`booleanField`/`arrayField`. */
export type FieldSpec =
  | { kind: "date"; column: ColumnOf<Date> } // timestamptz, mode:"date" → Date
  | { kind: "text"; column: ColumnOf<string> }
  | { kind: "number"; column: ColumnOf<number> }
  | { kind: "enum"; column: ColumnOf<string> } // text-with-enum column
  | { kind: "boolean"; column: ColumnOf<boolean> }
  | { kind: "array"; column: AnyColumn }; // pg array column — element type varies

/** A resource's filter allow-list: public field name → {@link FieldSpec}. Fields missing
 * from it are dropped by `buildWhere`/`buildFilterNode`. */
export type FilterSpec = Record<string, FieldSpec>;

/**
 * Allow-list a public field as a `date` filter over a Drizzle column whose data type is `Date`
 * (e.g. `timestamp(…, { mode: "date" })`). A `date` preset (`is`/`before`/`after`/`between` a
 * period) needs the `resolveDate` you pass to `buildWhere`; it becomes a half-open
 * `[start, end)` window. Passing a non-`Date` column is a compile error.
 *
 * @example
 * ```ts
 * import { PgDialect, pgTable, timestamp } from "drizzle-orm/pg-core";
 * import { buildWhere, dateField } from "@xtandard/lib/filters/drizzle";
 *
 * const posts = pgTable("posts", { createdAt: timestamp("created_at", { mode: "date" }) });
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({
 *   start: new Date("2026-01-01T00:00:00Z"),
 *   end: new Date("2026-02-01T00:00:00Z"),
 * });
 * const { where } = buildWhere({
 *   spec: { createdAt: dateField({ column: posts.createdAt }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * });
 * new PgDialect().sqlToQuery(where!).sql;
 * // → '("posts"."created_at" >= $1 and "posts"."created_at" < $2)'
 * ```
 */
export const dateField = (input: { column: ColumnOf<Date> }): FieldSpec => ({
  kind: "date",
  column: input.column,
});

/**
 * Allow-list a public field as a `text` filter over a Drizzle string column (`text`,
 * `varchar`, …). `contains`/`startsWith`/`endsWith` render as `ilike` with the input's
 * `%`/`_`/`\` escaped; on a SQLite or MySQL column, as `like … escape` instead. Passing a
 * non-string column is a compile error.
 *
 * @example
 * ```ts
 * import { PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { buildWhere, textField } from "@xtandard/lib/filters/drizzle";
 *
 * const users = pgTable("users", { name: text("name") });
 * const { where } = buildWhere({
 *   spec: { name: textField({ column: users.name }) },
 *   filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "ann" } }],
 * });
 * const { sql, params } = new PgDialect().sqlToQuery(where!);
 * // sql → '"users"."name" ilike $1', params → ["%ann%"]
 * ```
 */
export const textField = (input: { column: ColumnOf<string> }): FieldSpec => ({
  kind: "text",
  column: input.column,
});

/**
 * Allow-list a public field as a `number` filter over a Drizzle numeric column (`integer`,
 * `real`, …). `between` renders as `>= from and <= to`; `notBetween` as `< from or > to`.
 * Passing a non-number column is a compile error.
 *
 * @example
 * ```ts
 * import { integer, PgDialect, pgTable } from "drizzle-orm/pg-core";
 * import { buildWhere, numberField } from "@xtandard/lib/filters/drizzle";
 *
 * const orders = pgTable("orders", { total: integer("total") });
 * const { where } = buildWhere({
 *   spec: { total: numberField({ column: orders.total }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } }],
 * });
 * const { sql, params } = new PgDialect().sqlToQuery(where!);
 * // sql → '("orders"."total" >= $1 and "orders"."total" <= $2)', params → [10, 20]
 * ```
 */
export const numberField = (input: { column: ColumnOf<number> }): FieldSpec => ({
  kind: "number",
  column: input.column,
});

/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null
 * checks) over a Drizzle string column, typically `text(…, { enum: [...] })` or a `pgEnum`
 * column.
 *
 * @example
 * ```ts
 * import { PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { buildWhere, enumField } from "@xtandard/lib/filters/drizzle";
 *
 * const tasks = pgTable("tasks", { status: text("status", { enum: ["open", "done", "archived"] }) });
 * const { where } = buildWhere({
 *   spec: { status: enumField({ column: tasks.status }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "done"] } }],
 * });
 * const { sql, params } = new PgDialect().sqlToQuery(where!);
 * // sql → '"tasks"."status" in ($1, $2)', params → ["open", "done"]
 * ```
 */
export const enumField = (input: { column: ColumnOf<string> }): FieldSpec => ({
  kind: "enum",
  column: input.column,
});

/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a Drizzle
 * `boolean` column. Passing a non-boolean column is a compile error.
 *
 * @example
 * ```ts
 * import { boolean, PgDialect, pgTable } from "drizzle-orm/pg-core";
 * import { booleanField, buildWhere } from "@xtandard/lib/filters/drizzle";
 *
 * const tasks = pgTable("tasks", { done: boolean("done") });
 * const { where } = buildWhere({
 *   spec: { done: booleanField({ column: tasks.done }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "eq", value: false } }],
 * });
 * const { sql, params } = new PgDialect().sqlToQuery(where!);
 * // sql → '"tasks"."done" = $1', params → [false]
 * ```
 */
export const booleanField = (input: { column: ColumnOf<boolean> }): FieldSpec => ({
  kind: "boolean",
  column: input.column,
});

/**
 * Allow-list a public field as an `array` filter over a Postgres array column (any element
 * type). `arrayContains`/`arrayContained`/`arrayOverlaps` render as `@>`/`<@`/`&&`.
 *
 * @example
 * ```ts
 * import { PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { arrayField, buildWhere } from "@xtandard/lib/filters/drizzle";
 *
 * const posts = pgTable("posts", { tags: text("tags").array() });
 * const { where } = buildWhere({
 *   spec: { tags: arrayField({ column: posts.tags }) },
 *   filters: [{ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] } }],
 * });
 * const { sql, params } = new PgDialect().sqlToQuery(where!);
 * // sql → '"posts"."tags" && $1', params → ['{"ts","js"}']
 * ```
 */
export const arrayField = (input: { column: AnyColumn }): FieldSpec => ({
  kind: "array",
  column: input.column,
});
