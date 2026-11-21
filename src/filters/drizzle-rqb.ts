import {
  compileFilterNode,
  compileFilters,
  type DateFilterResolver,
  sqlTextOp,
} from "./compile.ts";
import { drizzleTextSql } from "./drizzle/dialect.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FieldKind, FilterNode } from "./types.ts";

/** One allow-listed field: its filter kind plus the schema property key (`"createdAt"`, not
 * the SQL column name) it reads. */
export type DrizzleRqbFieldSpec = { kind: FieldKind; column: string };
/** A resource's filter allow-list: public field name → {@link DrizzleRqbFieldSpec}. */
export type DrizzleRqbFilterSpec = Record<string, DrizzleRqbFieldSpec>;

/** A single column's RQBv2 condition (the inner `{ eq, gt, ilike, … }` object). */
export type RqbCondition = Record<string, unknown>;

/** A portable subset of the RQBv2 `where` shape this adapter emits: a single
 * column→condition object, or an `AND`/`OR`/`NOT` node. */
export type DrizzleRqbWhere =
  | { [column: string]: RqbCondition }
  | { AND: DrizzleRqbWhere[] }
  | { OR: DrizzleRqbWhere[] }
  | { NOT: DrizzleRqbWhere };

const make =
  (kind: FieldKind) =>
  (input: { column: string }): DrizzleRqbFieldSpec => ({ kind, column: input.column });

/**
 * Allow-list a public field as a `date` filter over a timestamp column, named by its Drizzle
 * schema property key (`"createdAt"`, not the SQL name `created_at`). A `date` preset needs
 * the `resolveDate` you pass to `buildWhere`, and becomes a half-open `gte`/`lt` window.
 *
 * @example
 * ```ts
 * import { buildWhere, dateField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") });
 * const { where } = buildWhere({
 *   spec: { createdAt: dateField({ column: "createdAt" }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * });
 * // where → { AND: [
 * //   { createdAt: { gte: new Date("2026-01-01T00:00:00Z") } },
 * //   { createdAt: { lt: new Date("2026-02-01T00:00:00Z") } },
 * // ] }
 * ```
 */
export const dateField = make("date");
/**
 * Allow-list a public field as a `text` filter over a string column, named by its Drizzle
 * schema property key (`"name"`). `contains`/`startsWith`/`endsWith` become `ilike` with the
 * input's `%`/`_`/`\` escaped. That is Postgres-only in the RQB v2 object (no `ESCAPE`, and
 * SQLite/MySQL have no `ilike`); the v1 callback renders `like … escape` on those columns.
 *
 * @example
 * ```ts
 * import { buildWhere, textField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const { where } = buildWhere({
 *   spec: { name: textField({ column: "name" }) },
 *   filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "ann" } }],
 * });
 * // where → { name: { ilike: "%ann%" } }
 * ```
 */
export const textField = make("text");
/**
 * Allow-list a public field as a `number` filter over a numeric column, named by its Drizzle
 * schema property key (`"total"`). `between` becomes `gte` + `lte`.
 *
 * @example
 * ```ts
 * import { buildWhere, numberField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const { where } = buildWhere({
 *   spec: { total: numberField({ column: "total" }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } }],
 * });
 * // where → { AND: [{ total: { gte: 10 } }, { total: { lte: 20 } }] }
 * ```
 */
export const numberField = make("number");
/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null checks)
 * over a column named by its Drizzle schema property key (`"status"`).
 *
 * @example
 * ```ts
 * import { buildWhere, enumField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const { where } = buildWhere({
 *   spec: { status: enumField({ column: "status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "done"] } }],
 * });
 * // where → { status: { in: ["open", "done"] } }
 * ```
 */
export const enumField = make("enum");
/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a column named by
 * its Drizzle schema property key (`"done"`).
 *
 * @example
 * ```ts
 * import { booleanField, buildWhere } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const { where } = buildWhere({
 *   spec: { done: booleanField({ column: "done" }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "eq", value: false } }],
 * });
 * // where → { done: { eq: false } }
 * ```
 */
export const booleanField = make("boolean");
/**
 * Allow-list a public field as an `array` filter over a Postgres array column, named by its
 * Drizzle schema property key (`"tags"`). The ops map 1:1 to RQB's `arrayContains`/
 * `arrayContained`/`arrayOverlaps`.
 *
 * @example
 * ```ts
 * import { arrayField, buildWhere } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const { where } = buildWhere({
 *   spec: { tags: arrayField({ column: "tags" }) },
 *   filters: [{ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] } }],
 * });
 * // where → { tags: { arrayOverlaps: ["ts", "js"] } }
 * ```
 */
export const arrayField = make("array");

function condToRqb(cond: CompiledCond): RqbCondition {
  switch (cond.op) {
    case "eq":
      return { eq: cond.value };
    case "ne":
      return { ne: cond.value };
    case "lt":
      return { lt: cond.value };
    case "gt":
      return { gt: cond.value };
    case "lte":
      return { lte: cond.value };
    case "gte":
      return { gte: cond.value };
    case "contains":
    case "startsWith":
    case "endsWith":
    case "like":
    case "ilike":
    case "notIlike": {
      const { op, pattern } = sqlTextOp(cond.op, cond.value);

      return { [op]: pattern };
    }
    case "inArray":
      return { in: cond.values };
    case "notInArray":
      return { notIn: cond.values };
    case "arrayContains":
      return { arrayContains: cond.values };
    case "arrayContained":
      return { arrayContained: cond.values };
    case "arrayOverlaps":
      return { arrayOverlaps: cond.values };
    case "isNull":
      return { isNull: true };
    case "isNotNull":
      return { isNotNull: true };
  }
}

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to an RQB v2 `where` object, mapping each
 * field to a schema property key through `columns`. Conditions on fields missing from
 * `columns` are dropped; `null` (or an AST that drops to nothing) gives `undefined`. Most code
 * calls `buildWhere`, which compiles and renders in one step.
 *
 * @example
 * ```ts
 * import { toDrizzleRqbWhere } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * toDrizzleRqbWhere({
 *   where: { type: "and", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "cond", cond: { field: "name", op: "isNotNull" } },
 *   ] },
 *   columns: { amount: "amount", name: "name" },
 * });
 * // → { AND: [{ amount: { gt: 5 } }, { name: { isNotNull: true } }] }
 * ```
 */
export function toDrizzleRqbWhere(input: {
  where: CompiledWhere | null;
  columns: Record<string, string>;
}): DrizzleRqbWhere | undefined {
  const render = (node: CompiledWhere): DrizzleRqbWhere | undefined => {
    switch (node.type) {
      case "cond": {
        const column = input.columns[node.cond.field];

        return column === undefined ? undefined : { [column]: condToRqb(node.cond) };
      }
      case "and":
      case "or": {
        const parts = node.nodes.map(render).filter((p): p is DrizzleRqbWhere => p !== undefined);
        if (parts.length === 0) return undefined;

        return node.type === "and" ? { AND: parts } : { OR: parts };
      }
      case "not": {
        const inner = render(node.node);

        return inner === undefined ? undefined : { NOT: inner };
      }
    }
  };

  return input.where ? render(input.where) : undefined;
}

const columnsOf = (spec: DrizzleRqbFilterSpec): Record<string, string> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.column]));
const kindsOf = (spec: DrizzleRqbFilterSpec): Record<string, FieldKind> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.kind]));

/**
 * Compile a flat, AND-combined list of column filters into an RQB v2 `where` object for
 * `db.query.<table>.findMany({ where })` (drizzle v1). Only fields in `spec` whose kind matches
 * the filter's `kind` are kept; the rest are silently dropped. `where` is `undefined` when
 * nothing survives. A `date` preset filter needs `resolveDate` (it throws without one).
 *
 * @example
 * ```ts
 * import { buildWhere, numberField, textField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const { where } = buildWhere({ spec, filters: [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ] });
 * // where → { AND: [{ name: { ilike: "Re%" } }, { amount: { gte: 100 } }] }
 * // in an app: await db.query.tasks.findMany({ where, limit: 20 });
 * ```
 */
export function buildWhere(input: {
  spec: DrizzleRqbFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): { where: DrizzleRqbWhere | undefined } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return { where: toDrizzleRqbWhere({ where, columns: columnsOf(input.spec) }) };
}

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into an RQB v2 `where` object
 * (or `undefined`). Same allow-list rules as `buildWhere`.
 *
 * @example
 * ```ts
 * import { buildFilterNode, numberField, textField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const { where } = buildFilterNode({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * // where → { OR: [{ name: { eq: "Rent" } }, { NOT: { amount: { lt: 0 } } }] }
 * ```
 */
export function buildFilterNode(input: {
  spec: DrizzleRqbFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): { where: DrizzleRqbWhere | undefined } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return { where: toDrizzleRqbWhere({ where, columns: columnsOf(input.spec) }) };
}

// ── RQB v1 (legacy callback `where: (fields, operators) => SQL`) ──────────────

/**
 * The `sql` tag the RQB **v1** operators carry: a tagged template that builds the SQL type `R`,
 * plus `sql.param(value, encoder)` to bind a value through a column's driver encoding.
 */
export interface RqbV1Sql<R> {
  (strings: TemplateStringsArray, ...params: unknown[]): R;
  param(value: unknown, encoder?: { mapToDriverValue(value: unknown): unknown }): unknown;
}

/**
 * The drizzle operators the RQB **v1** `where` callback receives as its second
 * argument (`(fields, operators) => …`, drizzle's `getOperators()`). Structural + generic over
 * the SQL type `R` so this adapter imports no `drizzle-orm`. `and`/`or` may return `undefined`
 * (no conditions), matching drizzle.
 *
 * Drizzle's set has no array operators, so the `array` ops (Postgres `@>`/`<@`/`&&`) are built
 * with its `sql` tag, binding the values through the column's encoder like drizzle's own
 * `arrayContains`/`arrayContained`/`arrayOverlaps` do. An operators object that does carry
 * those three uses them instead.
 *
 * `R` is inferred only from the return types (`NoInfer` on the `and`/`or`/`not` inputs):
 * drizzle's inputs are the wider `SQLWrapper`, and TypeScript 7 would otherwise infer
 * `R = SQLWrapper`, so the callback would no longer fit drizzle's `where`.
 */
export interface RqbV1Operators<R> {
  eq(column: unknown, value: unknown): R;
  ne(column: unknown, value: unknown): R;
  gt(column: unknown, value: unknown): R;
  gte(column: unknown, value: unknown): R;
  lt(column: unknown, value: unknown): R;
  lte(column: unknown, value: unknown): R;
  like(column: unknown, value: string): R;
  ilike(column: unknown, value: string): R;
  notIlike(column: unknown, value: string): R;
  inArray(column: unknown, values: unknown[]): R;
  notInArray(column: unknown, values: unknown[]): R;
  isNull(column: unknown): R;
  isNotNull(column: unknown): R;
  and(...conditions: (NoInfer<R> | undefined)[]): R | undefined;
  or(...conditions: (NoInfer<R> | undefined)[]): R | undefined;
  not(condition: NoInfer<R>): R;
  sql: RqbV1Sql<R>;
  arrayContains?(column: unknown, values: unknown[]): R;
  arrayContained?(column: unknown, values: unknown[]): R;
  arrayOverlaps?(column: unknown, values: unknown[]): R;
}

// Postgres array ops for the v1 callback: the caller's own operator when it has one, else
// `column <op> $param` built with drizzle's `sql` tag. The values bind through the column's
// `mapToDriverValue` (what drizzle's `arrayContains` does), so a `text[]` column gets a PG
// array literal.
function arrayOpV1<R>(
  op: "arrayContains" | "arrayContained" | "arrayOverlaps",
  column: unknown,
  values: unknown[],
  ops: RqbV1Operators<R>,
): R {
  const own = ops[op];
  if (own) return own.call(ops, column, values);

  const encoder =
    typeof (column as { mapToDriverValue?: unknown } | null)?.mapToDriverValue === "function"
      ? (column as { mapToDriverValue(value: unknown): unknown })
      : undefined;
  const param = ops.sql.param(values, encoder);

  return op === "arrayContains"
    ? ops.sql`${column} @> ${param}`
    : op === "arrayContained"
      ? ops.sql`${column} <@ ${param}`
      : ops.sql`${column} && ${param}`;
}

/** An RQB v1 `where` callback: `(fields, operators) => SQL | undefined`. `fields`
 * is the (aliased) table the RQB passes; keys are schema property names. */
export type RqbV1WhereCallback = <R>(
  fields: Record<string, unknown>,
  operators: RqbV1Operators<R>,
) => R | undefined;

function condV1<R>(cond: CompiledCond, column: unknown, ops: RqbV1Operators<R>): R {
  switch (cond.op) {
    case "eq":
      return ops.eq(column, cond.value);
    case "ne":
      return ops.ne(column, cond.value);
    case "lt":
      return ops.lt(column, cond.value);
    case "gt":
      return ops.gt(column, cond.value);
    case "lte":
      return ops.lte(column, cond.value);
    case "gte":
      return ops.gte(column, cond.value);
    case "contains":
    case "startsWith":
    case "endsWith":
    case "like":
    case "ilike":
    case "notIlike": {
      // SQLite/MySQL column: `like … escape` via drizzle's `sql` (they have no `ilike`, and
      // need the ESCAPE clause for the backslash-escaped pattern).
      const dialectSql = drizzleTextSql(ops.sql, column, cond.op, cond.value);
      if (dialectSql !== undefined) return dialectSql;

      const { op, pattern } = sqlTextOp(cond.op, cond.value);

      return op === "like"
        ? ops.like(column, pattern)
        : op === "ilike"
          ? ops.ilike(column, pattern)
          : ops.notIlike(column, pattern);
    }
    case "inArray":
      return ops.inArray(column, cond.values);
    case "notInArray":
      return ops.notInArray(column, cond.values);
    case "arrayContains":
    case "arrayContained":
    case "arrayOverlaps":
      return arrayOpV1(cond.op, column, cond.values, ops);
    case "isNull":
      return ops.isNull(column);
    case "isNotNull":
      return ops.isNotNull(column);
  }
}

/**
 * Render an already-compiled {@link CompiledWhere} AST to an RQB **v1** `where` callback
 * `(fields, operators) => SQL | undefined`. `columns` maps each field to a schema property key,
 * which the callback looks up in the `fields` drizzle passes in. Conditions on unknown fields
 * are dropped; when nothing is left the callback returns `undefined`. Most code calls
 * `buildRqbV1Where`, which compiles and renders in one step.
 *
 * @example
 * ```ts
 * import { getOperators } from "drizzle-orm";
 * import { integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { toDrizzleRqbV1Callback } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const tasks = pgTable("tasks", { name: text("name"), amount: integer("amount") });
 * const where = toDrizzleRqbV1Callback({
 *   where: { type: "and", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "cond", cond: { field: "name", op: "isNotNull" } },
 *   ] },
 *   columns: { amount: "amount", name: "name" },
 * });
 * // drizzle calls where(fields, getOperators()) itself; calling it by hand shows the SQL.
 * new PgDialect().sqlToQuery(where({ ...tasks }, getOperators())!).sql;
 * // → '("tasks"."amount" > $1 and "tasks"."name" is not null)'
 * ```
 */
export function toDrizzleRqbV1Callback(input: {
  where: CompiledWhere | null;
  columns: Record<string, string>;
}): RqbV1WhereCallback {
  return <R>(fields: Record<string, unknown>, ops: RqbV1Operators<R>): R | undefined => {
    const render = (node: CompiledWhere): R | undefined => {
      switch (node.type) {
        case "cond": {
          const key = input.columns[node.cond.field];
          if (key === undefined) return undefined;

          const column = fields[key];

          return column === undefined ? undefined : condV1(node.cond, column, ops);
        }
        case "and":
        case "or": {
          const parts = node.nodes.map(render).filter((p): p is R => p !== undefined);
          if (parts.length === 0) return undefined;

          return node.type === "and" ? ops.and(...parts) : ops.or(...parts);
        }
        case "not": {
          const inner = render(node.node);

          return inner === undefined ? undefined : ops.not(inner);
        }
      }
    };

    return input.where ? render(input.where) : undefined;
  };
}

/**
 * Compile a flat, AND-combined list of column filters into an RQB **v1** `where` callback for
 * the legacy relational API (`db._query` in drizzle v1, `db.query` in drizzle 0.x). The
 * callback builds the SQL from the `fields` and `operators` drizzle passes in, so columns
 * resolve against the query's aliased table. Same allow-list rules as `buildWhere`; when no
 * filter survives, the callback returns `undefined`. `array` filters render as Postgres
 * `@>`/`<@`/`&&` (see {@link RqbV1Operators}).
 *
 * @example
 * ```ts
 * import { getOperators } from "drizzle-orm";
 * import { integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { arrayField, buildRqbV1Where, numberField, textField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const tasks = pgTable("tasks", { name: text("name"), amount: integer("amount"), tags: text("tags").array() });
 * const spec = {
 *   name: textField({ column: "name" }),
 *   amount: numberField({ column: "amount" }),
 *   tags: arrayField({ column: "tags" }),
 * };
 * const { where } = buildRqbV1Where({ spec, filters: [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 *   { field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts"] } },
 * ] });
 * // in an app: await db._query.tasks.findMany({ where });
 * // drizzle calls where(fields, getOperators()) itself; calling it by hand shows the SQL.
 * new PgDialect().sqlToQuery(where({ ...tasks }, getOperators())!).sql;
 * // → '("tasks"."name" ilike $1 and "tasks"."amount" >= $2 and "tasks"."tags" && $3)'
 * ```
 */
export function buildRqbV1Where(input: {
  spec: DrizzleRqbFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): { where: RqbV1WhereCallback } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return { where: toDrizzleRqbV1Callback({ where, columns: columnsOf(input.spec) }) };
}

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into an RQB **v1** `where`
 * callback. Same allow-list rules as `buildRqbV1Where`.
 *
 * @example
 * ```ts
 * import { getOperators } from "drizzle-orm";
 * import { integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { buildRqbV1FilterNode, numberField, textField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * const tasks = pgTable("tasks", { name: text("name"), amount: integer("amount") });
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const { where } = buildRqbV1FilterNode({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * // in an app: await db._query.tasks.findMany({ where });
 * // drizzle calls where(fields, getOperators()) itself; calling it by hand shows the SQL.
 * new PgDialect().sqlToQuery(where({ ...tasks }, getOperators())!).sql;
 * // → '("tasks"."name" = $1 or not "tasks"."amount" < $2)'
 * ```
 */
export function buildRqbV1FilterNode(input: {
  spec: DrizzleRqbFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): { where: RqbV1WhereCallback } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return { where: toDrizzleRqbV1Callback({ where, columns: columnsOf(input.spec) }) };
}
