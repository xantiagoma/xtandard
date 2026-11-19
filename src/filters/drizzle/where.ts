import type { AnyColumn, SQL } from "drizzle-orm";

import {
  and,
  arrayContained,
  arrayContains,
  arrayOverlaps,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  notIlike,
  notInArray,
  or,
} from "drizzle-orm";

import {
  compileFilterNode,
  compileFilters,
  type DateFilterResolver,
  sqlTextOp,
} from "../compile.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FilterNode } from "../types.ts";
import type { FilterSpec } from "./spec.ts";

// Render the portable CompiledWhere AST to a Drizzle `SQL`. `buildWhere` /
// `buildFilterNode` compile the filter model (via the driver-free core) and
// render it here against the spec's columns.

function condToSql(cond: CompiledCond, column: AnyColumn): SQL | undefined {
  switch (cond.op) {
    case "eq":
      return eq(column, cond.value);
    case "ne":
      return ne(column, cond.value);
    case "lt":
      return lt(column, cond.value);
    case "gt":
      return gt(column, cond.value);
    case "lte":
      return lte(column, cond.value);
    case "gte":
      return gte(column, cond.value);
    case "contains":
    case "startsWith":
    case "endsWith":
    case "like":
    case "ilike":
    case "notIlike": {
      const { op, pattern } = sqlTextOp(cond.op, cond.value);

      return op === "like"
        ? like(column, pattern)
        : op === "ilike"
          ? ilike(column, pattern)
          : notIlike(column, pattern);
    }
    case "inArray":
      return inArray(column, cond.values);
    case "notInArray":
      return notInArray(column, cond.values);
    case "arrayContains":
      return arrayContains(column, cond.values);
    case "arrayContained":
      return arrayContained(column, cond.values);
    case "arrayOverlaps":
      return arrayOverlaps(column, cond.values);
    case "isNull":
      return isNull(column);
    case "isNotNull":
      return isNotNull(column);
  }
}

function isSql(value: SQL | undefined): value is SQL {
  return value !== undefined;
}

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to a Drizzle `SQL`, looking each field up in
 * `columns`. Conditions on fields missing from `columns` are dropped; `null` (or an AST that
 * drops to nothing) gives `undefined`. Most code calls `buildWhere`, which compiles and renders
 * in one step.
 *
 * @example
 * ```ts
 * import { integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { toDrizzleWhere } from "@xtandard/lib/filters/drizzle";
 *
 * const tasks = pgTable("tasks", { name: text("name"), amount: integer("amount") });
 * const where = toDrizzleWhere({
 *   where: { type: "and", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "cond", cond: { field: "name", op: "isNotNull" } },
 *   ] },
 *   columns: { amount: tasks.amount, name: tasks.name },
 * });
 * const { sql, params } = new PgDialect().sqlToQuery(where!);
 * // sql → '("tasks"."amount" > $1 and "tasks"."name" is not null)', params → [5]
 * ```
 */
export function toDrizzleWhere(input: {
  where: CompiledWhere | null;
  columns: Record<string, AnyColumn>;
}): SQL | undefined {
  const render = (node: CompiledWhere): SQL | undefined => {
    switch (node.type) {
      case "cond": {
        const column = input.columns[node.cond.field];

        return column ? condToSql(node.cond, column) : undefined;
      }
      case "and":
        return and(...node.nodes.map(render).filter(isSql));
      case "or":
        return or(...node.nodes.map(render).filter(isSql));
      case "not": {
        const inner = render(node.node);

        return inner ? not(inner) : undefined;
      }
    }
  };

  return input.where ? render(input.where) : undefined;
}

function columnsOf(spec: FilterSpec): Record<string, AnyColumn> {
  const out: Record<string, AnyColumn> = {};
  for (const [field, fieldSpec] of Object.entries(spec)) out[field] = fieldSpec.column;

  return out;
}

function kindsOf(spec: FilterSpec): Record<string, FilterSpec[string]["kind"]> {
  const out: Record<string, FilterSpec[string]["kind"]> = {};
  for (const [field, fieldSpec] of Object.entries(spec)) out[field] = fieldSpec.kind;

  return out;
}

/**
 * Compile a flat, AND-combined list of column filters into a Drizzle `SQL` for
 * `db.select().from(t).where(where)`. Only fields in `spec` whose kind matches the filter's
 * `kind` are kept (the allow-list); the rest are silently dropped. `where` is `undefined`
 * when nothing survives, which Drizzle's `.where()` treats as "no filter". A `date` preset
 * filter needs `resolveDate` (it throws without one).
 *
 * @example
 * ```ts
 * import { integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { buildWhere, numberField, textField } from "@xtandard/lib/filters/drizzle";
 *
 * const tasks = pgTable("tasks", { name: text("name"), amount: integer("amount") });
 * const spec = { name: textField({ column: tasks.name }), amount: numberField({ column: tasks.amount }) };
 * const { where } = buildWhere({ spec, filters: [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 *   { field: "secret", filter: { kind: "text", operator: "eq", value: "x" } }, // not in spec → dropped
 * ] });
 * const { sql, params } = new PgDialect().sqlToQuery(where!);
 * // sql → '("tasks"."name" ilike $1 and "tasks"."amount" >= $2)', params → ["Re%", 100]
 * // in an app: await db.select().from(tasks).where(where)
 * ```
 */
export function buildWhere(input: {
  spec: FilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): { where: SQL | undefined } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return { where: toDrizzleWhere({ where, columns: columnsOf(input.spec) }) };
}

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into a Drizzle `SQL`. Same
 * allow-list rules as `buildWhere`: leaves on unknown fields or with a mismatched kind are
 * dropped, and `where` is `undefined` when nothing is left.
 *
 * @example
 * ```ts
 * import { integer, PgDialect, pgTable, text } from "drizzle-orm/pg-core";
 * import { buildFilterNode, numberField, textField } from "@xtandard/lib/filters/drizzle";
 *
 * const tasks = pgTable("tasks", { name: text("name"), amount: integer("amount") });
 * const spec = { name: textField({ column: tasks.name }), amount: numberField({ column: tasks.amount }) };
 * const { where } = buildFilterNode({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "column", field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ] } });
 * const { sql, params } = new PgDialect().sqlToQuery(where!);
 * // sql → '("tasks"."name" = $1 or "tasks"."amount" >= $2)', params → ["Rent", 100]
 * ```
 */
export function buildFilterNode(input: {
  spec: FilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): { where: SQL | undefined } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return { where: toDrizzleWhere({ where, columns: columnsOf(input.spec) }) };
}
