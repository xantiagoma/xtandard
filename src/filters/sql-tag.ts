import {
  compileFilterNode,
  compileFilters,
  type DateFilterResolver,
  type SqlDialect,
  sqlTextOp,
} from "./compile.ts";
import type {
  ColumnFilter,
  CompiledCond,
  CompiledWhere,
  FieldKind,
  FilterNode,
  Sort,
} from "./types.ts";

import {
  type SqlTag,
  type SqlTagFragment,
  type SqlTagTarget,
  sqlTagJoin,
  sqlTagRef,
} from "../sql-tag.ts";

export type { SqlDialect } from "./compile.ts";
export type { SqlTag, SqlTagFragment, SqlTagTarget } from "../sql-tag.ts";

/** One allow-listed field: its filter kind plus the {@link SqlTagTarget} it reads. */
export type SqlTagFieldSpec = { kind: FieldKind; column: SqlTagTarget };
/** A resource's filter allow-list: public field name → {@link SqlTagFieldSpec}. */
export type SqlTagFilterSpec = Record<string, SqlTagFieldSpec>;

const field =
  (kind: FieldKind) =>
  (input: { column: SqlTagTarget }): SqlTagFieldSpec => ({ kind, column: input.column });

/**
 * Allow-list a public field as a `date` filter over a timestamp column, given as a column
 * string (`"posts.created_at"`) or a fragment from your `sql` tag. A `date` preset needs the
 * `resolveDate` you pass to `buildWhere`, and becomes a half-open `[start, end)` window.
 *
 * @example
 * ```ts
 * import postgres from "postgres";
 * import { buildWhere, dateField } from "@xtandard/lib/filters/sql-tag";
 *
 * const sql = postgres(process.env.DATABASE_URL);
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") });
 * const { where } = buildWhere({
 *   sql,
 *   spec: { createdAt: dateField({ column: "posts.created_at" }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * });
 * const rows = await sql`select * from posts where ${where ?? sql`true`}`;
 * // where ("posts"."created_at" >= $1 AND "posts"."created_at" < $2)
 * ```
 */
export const dateField = field("date");
/**
 * Allow-list a public field as a `text` filter over a string column, given as a column string
 * (`"users.name"`) or a fragment from your `sql` tag. `contains`/`startsWith`/`endsWith`
 * render as `ILIKE` on Postgres and `LIKE` on MySQL/SQLite, with the input's `%`/`_`/`\`
 * escaped (plus an `ESCAPE` clause on MySQL/SQLite, so they match literally).
 *
 * @example
 * ```ts
 * import { buildWhere, textField } from "@xtandard/lib/filters/sql-tag";
 *
 * const { where } = buildWhere({
 *   sql, // postgres.js or Bun.sql
 *   spec: { name: textField({ column: "users.name" }) },
 *   filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "ann" } }],
 * });
 * await sql`select * from users where ${where ?? sql`true`}`;
 * // where "users"."name" ILIKE $1, parameters ["%ann%"]
 * ```
 */
export const textField = field("text");
/**
 * Allow-list a public field as a `number` filter over a numeric column, given as a column
 * string (`"orders.total"`) or a fragment from your `sql` tag. `between` renders as
 * `>= AND <=`.
 *
 * @example
 * ```ts
 * import { buildWhere, numberField } from "@xtandard/lib/filters/sql-tag";
 *
 * const { where } = buildWhere({
 *   sql, // postgres.js or Bun.sql
 *   spec: { total: numberField({ column: "orders.total" }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } }],
 * });
 * // where ("orders"."total" >= $1 AND "orders"."total" <= $2), parameters [10, 20]
 * ```
 */
export const numberField = field("number");
/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null checks)
 * over a column string (`"tasks.status"`) or a fragment from your `sql` tag. `inArray` binds
 * one parameter per value: `IN ($1, $2)`.
 *
 * @example
 * ```ts
 * import { buildWhere, enumField } from "@xtandard/lib/filters/sql-tag";
 *
 * const { where } = buildWhere({
 *   sql, // postgres.js or Bun.sql
 *   spec: { status: enumField({ column: "tasks.status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "done"] } }],
 * });
 * // where "tasks"."status" IN ($1, $2), parameters ["open", "done"]
 * ```
 */
export const enumField = field("enum");
/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a column string
 * (`"tasks.done"`) or a fragment from your `sql` tag.
 *
 * @example
 * ```ts
 * import { booleanField, buildWhere } from "@xtandard/lib/filters/sql-tag";
 *
 * const { where } = buildWhere({
 *   sql, // postgres.js or Bun.sql
 *   spec: { done: booleanField({ column: "tasks.done" }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "eq", value: false } }],
 * });
 * // where "tasks"."done" = $1, parameters [false]
 * ```
 */
export const booleanField = field("boolean");
/**
 * Allow-list a public field as an `array` filter over a column string (`"posts.tags"`) or a
 * fragment from your `sql` tag. The SQL depends on `dialect`: a native array with
 * `@>`/`<@`/`&&` on Postgres (the array binds as one parameter), a JSON column with
 * `JSON_CONTAINS`/`JSON_OVERLAPS` on MySQL, and `json_each(…)` subqueries on SQLite (both bind
 * the array as a JSON string).
 *
 * @example
 * ```ts
 * import { arrayField, buildWhere } from "@xtandard/lib/filters/sql-tag";
 *
 * const { where } = buildWhere({
 *   sql, // postgres.js or Bun.sql
 *   spec: { tags: arrayField({ column: "posts.tags" }) },
 *   filters: [{ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] } }],
 * });
 * // where "posts"."tags" && $1, parameters [["ts", "js"]]
 * // with dialect: "mysql" (Bun.sql): JSON_OVERLAPS(`posts`.`tags`, ?), parameters ['["ts","js"]']
 * ```
 */
export const arrayField = field("array");

// `escapeLike` escapes with a backslash. That is Postgres's default LIKE escape (no clause
// needed); SQLite has no default escape and MySQL drops its default under
// NO_BACKSLASH_ESCAPES, so both name it. CHAR(92) is `\` in every MySQL sql_mode, where a
// '\\' literal changes meaning with NO_BACKSLASH_ESCAPES.
function likeSql(
  sql: SqlTag,
  col: unknown,
  op: "like" | "ilike" | "notIlike",
  pattern: string,
  dialect: SqlDialect,
): unknown {
  if (dialect === "postgres") {
    if (op === "like") return sql`${col} LIKE ${pattern}`;
    if (op === "ilike") return sql`${col} ILIKE ${pattern}`;

    return sql`${col} NOT ILIKE ${pattern}`;
  }
  // ILIKE is PG-only; on MySQL/SQLite fold to LIKE (case-insensitive by collation / ASCII),
  // the closest portable spelling of the intent.
  if (dialect === "mysql") {
    if (op === "notIlike") return sql`${col} NOT LIKE ${pattern} ESCAPE CHAR(92)`;

    return sql`${col} LIKE ${pattern} ESCAPE CHAR(92)`;
  }
  if (op === "notIlike") return sql`${col} NOT LIKE ${pattern} ESCAPE '\\'`;

  return sql`${col} LIKE ${pattern} ESCAPE '\\'`;
}

// The `array` ops have no portable spelling — render per dialect. PG uses the native set
// operators (the array binds as one parameter); MySQL the JSON functions (JSON-typed column,
// 8.0.17+ for JSON_OVERLAPS); SQLite a json_each(…) subquery (JSON1, bundled since 3.38). The
// candidate array binds as a JSON string for MySQL/SQLite.
function arrayOpSql(
  sql: SqlTag,
  op: "arrayContains" | "arrayContained" | "arrayOverlaps",
  col: unknown,
  values: (string | number)[],
  dialect: SqlDialect,
): unknown {
  if (dialect === "postgres") {
    if (op === "arrayContains") return sql`${col} @> ${values}`;
    if (op === "arrayContained") return sql`${col} <@ ${values}`;

    return sql`${col} && ${values}`;
  }

  const json = JSON.stringify(values);

  if (dialect === "mysql") {
    if (op === "arrayContains") return sql`JSON_CONTAINS(${col}, ${json})`;
    if (op === "arrayContained") return sql`JSON_CONTAINS(${json}, ${col})`;

    return sql`JSON_OVERLAPS(${col}, ${json})`;
  }

  // sqlite — every element of A is in B ⇔ no element of A is absent from B.
  if (op === "arrayContains") {
    return sql`NOT EXISTS (SELECT 1 FROM json_each(${json}) je WHERE je.value NOT IN (SELECT value FROM json_each(${col})))`;
  }
  if (op === "arrayContained") {
    return sql`NOT EXISTS (SELECT 1 FROM json_each(${col}) je WHERE je.value NOT IN (SELECT value FROM json_each(${json})))`;
  }

  return sql`EXISTS (SELECT 1 FROM json_each(${col}) je WHERE je.value IN (SELECT value FROM json_each(${json})))`;
}

// Each value becomes its own parameter: `($1, $2)`. (The clients' own `sql(values)` list
// helpers differ: postgres.js picks the builder by sniffing the preceding SQL keyword.)
const valueList = (sql: SqlTag, values: readonly unknown[]): unknown =>
  sqlTagJoin(
    sql,
    values.map((v) => sql`${v}`),
    "comma",
  );

function condSql(sql: SqlTag, cond: CompiledCond, col: unknown, dialect: SqlDialect): unknown {
  switch (cond.op) {
    case "eq":
      return sql`${col} = ${cond.value}`;
    case "ne":
      return sql`${col} <> ${cond.value}`;
    case "lt":
      return sql`${col} < ${cond.value}`;
    case "gt":
      return sql`${col} > ${cond.value}`;
    case "lte":
      return sql`${col} <= ${cond.value}`;
    case "gte":
      return sql`${col} >= ${cond.value}`;
    case "contains":
    case "startsWith":
    case "endsWith":
    case "like":
    case "ilike":
    case "notIlike": {
      const { op, pattern } = sqlTextOp(cond.op, cond.value);

      return likeSql(sql, col, op, pattern, dialect);
    }
    case "inArray":
      return sql`${col} IN (${valueList(sql, cond.values)})`;
    case "notInArray":
      return sql`${col} NOT IN (${valueList(sql, cond.values)})`;
    case "arrayContains":
    case "arrayContained":
    case "arrayOverlaps":
      return arrayOpSql(sql, cond.op, col, cond.values, dialect);
    case "isNull":
      return sql`${col} IS NULL`;
    case "isNotNull":
      return sql`${col} IS NOT NULL`;
  }
}

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to a fragment of your `sql` tag, looking each
 * field up in `columns`. Conditions on fields missing from `columns` are dropped; `null` (or an
 * AST that drops to nothing) gives `undefined`. Most code calls `buildWhere`, which compiles
 * and renders in one step.
 *
 * @example
 * ```ts
 * import { toSqlTagWhere } from "@xtandard/lib/filters/sql-tag";
 *
 * const where = toSqlTagWhere({
 *   sql, // postgres.js or Bun.sql
 *   where: { type: "and", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "cond", cond: { field: "name", op: "isNotNull" } },
 *   ] },
 *   columns: { amount: "tasks.amount", name: "tasks.name" },
 * });
 * await sql`select * from tasks where ${where ?? sql`true`}`;
 * // where ("tasks"."amount" > $1 AND "tasks"."name" IS NOT NULL), parameters [5]
 * ```
 */
export function toSqlTagWhere<S extends SqlTag>(input: {
  sql: S;
  where: CompiledWhere | null;
  columns: Record<string, SqlTagTarget>;
  dialect?: SqlDialect;
}): SqlTagFragment<S> | undefined {
  const { sql } = input;
  const dialect = input.dialect ?? "postgres";
  const render = (node: CompiledWhere): unknown => {
    switch (node.type) {
      case "cond": {
        const col = input.columns[node.cond.field];

        return col === undefined
          ? undefined
          : condSql(sql, node.cond, sqlTagRef(sql, col, "filters/sql-tag"), dialect);
      }
      case "and":
      case "or": {
        const parts = node.nodes.map(render).filter((p) => p !== undefined);
        if (parts.length === 0) return undefined;

        return sql`(${sqlTagJoin(sql, parts, node.type)})`;
      }
      case "not": {
        const inner = render(node.node);

        return inner === undefined ? undefined : sql`NOT (${inner})`;
      }
    }
  };

  return (input.where ? render(input.where) : undefined) as SqlTagFragment<S> | undefined;
}

const columnsOf = (spec: SqlTagFilterSpec): Record<string, SqlTagTarget> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.column]));
const kindsOf = (spec: SqlTagFilterSpec): Record<string, FieldKind> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.kind]));

/**
 * Compile a flat, AND-combined list of column filters into a fragment of your `sql` tag
 * (postgres.js or Bun.sql) to embed after `where`. Only fields in `spec` whose kind matches the
 * filter's `kind` are kept; the rest are silently dropped. `where` is `undefined` when nothing
 * survives. A `date` preset filter needs `resolveDate` (it throws without one). `dialect`
 * (default `"postgres"`; `"mysql"`/`"sqlite"` for Bun.sql's other adapters) changes the `array`
 * ops, `ilike` and the `LIKE` escape clause. Values are always parameters; column strings are
 * validated and quoted by `sql(identifier)`.
 *
 * @example
 * ```ts
 * import postgres from "postgres"; // or: import { sql } from "bun";
 * import { buildWhere, numberField, textField } from "@xtandard/lib/filters/sql-tag";
 *
 * const sql = postgres(process.env.DATABASE_URL);
 * const spec = { name: textField({ column: "tasks.name" }), amount: numberField({ column: "tasks.amount" }) };
 * const { where } = buildWhere({ sql, spec, filters: [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ] });
 * const rows = await sql`select * from tasks ${where ? sql`where ${where}` : sql``}`;
 * // select * from tasks where ("tasks"."name" ILIKE $1 AND "tasks"."amount" >= $2)
 * // parameters ["Re%", 100]
 * ```
 */
export function buildWhere<S extends SqlTag>(input: {
  sql: S;
  spec: SqlTagFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
  dialect?: SqlDialect;
}): { where: SqlTagFragment<S> | undefined } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return {
    where: toSqlTagWhere({
      sql: input.sql,
      where,
      columns: columnsOf(input.spec),
      dialect: input.dialect,
    }),
  };
}

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into a fragment of your `sql`
 * tag (or `undefined`). Same allow-list and `dialect` rules as `buildWhere`.
 *
 * @example
 * ```ts
 * import { buildFilterNode, numberField, textField } from "@xtandard/lib/filters/sql-tag";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const { where } = buildFilterNode({ sql, spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * await sql`select * from tasks where ${where ?? sql`true`}`;
 * // where ("name" = $1 OR NOT ("amount" < $2)), parameters ["Rent", 0]
 * ```
 */
export function buildFilterNode<S extends SqlTag>(input: {
  sql: S;
  spec: SqlTagFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
  dialect?: SqlDialect;
}): { where: SqlTagFragment<S> | undefined } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return {
    where: toSqlTagWhere({
      sql: input.sql,
      where,
      columns: columnsOf(input.spec),
      dialect: input.dialect,
    }),
  };
}

/**
 * Render a `Sort` to ONE comma-separated fragment of your `sql` tag to embed after `order by`,
 * allow-listed to `columns` (public field name → {@link SqlTagTarget}). Unknown fields are
 * dropped; when nothing is left, `defaultSort` is used instead, and `orderBy` is `undefined`
 * when that is empty too. (One fragment, not an array: both clients join an array of
 * fragments with spaces.)
 *
 * @example
 * ```ts
 * import { buildOrderBy } from "@xtandard/lib/filters/sql-tag";
 *
 * const { orderBy } = buildOrderBy({
 *   sql, // postgres.js or Bun.sql
 *   sort: [{ field: "amount", dir: "desc" }, { field: "password", dir: "asc" }], // password: not sortable
 *   columns: { name: "tasks.name", amount: "tasks.amount" },
 *   defaultSort: [{ field: "name", dir: "asc" }],
 * });
 * await sql`select * from tasks order by ${orderBy ?? sql`"tasks"."id"`}`;
 * // select * from tasks order by "tasks"."amount" DESC
 * ```
 */
export function buildOrderBy<S extends SqlTag>(input: {
  sql: S;
  sort: Sort;
  columns: Record<string, SqlTagTarget>;
  defaultSort?: Sort;
}): { orderBy: SqlTagFragment<S> | undefined } {
  const { sql } = input;
  const resolve = (sort: Sort): unknown[] =>
    sort.flatMap((item) => {
      const target = input.columns[item.field];
      if (target === undefined) return [];
      const col = sqlTagRef(sql, target, "filters/sql-tag");

      return [item.dir === "asc" ? sql`${col} ASC` : sql`${col} DESC`];
    });

  let ordered = resolve(input.sort);
  if (ordered.length === 0) ordered = resolve(input.defaultSort ?? []);

  return {
    orderBy: (ordered.length > 0 ? sqlTagJoin(sql, ordered, "comma") : undefined) as
      | SqlTagFragment<S>
      | undefined,
  };
}
