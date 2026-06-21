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

/**
 * Render the portable {@link CompiledWhere} AST to a Drizzle `SQL`. `buildWhere`
 * / `buildFilterNode` compile the filter model (via the driver-free core) and
 * render it here against the spec's columns. The `date` preset is resolved by an
 * injected `resolveDate` (e.g. an app's `@demi.casa/time` `resolveDateFilter`).
 *
 * @example
 * ```ts
 * import { buildWhere, textField, numberField, dateField } from "@xtandard/lib/filters/drizzle";
 *
 * const spec = {
 *   name: textField({ column: tasks.name }), // ColumnOf<string> — kind↔column mismatch = compile error
 *   amount: numberField({ column: tasks.amount }),
 *   createdAt: dateField({ column: tasks.createdAt }),
 * };
 * const { where } = buildWhere({ spec, filters, resolveDate }); // resolveDate injected for `date`
 * const rows = await db.select().from(tasks).where(where);
 * ```
 */

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

/** Render a {@link CompiledWhere} AST to a Drizzle `SQL` against a column map. */
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

/** Flat AND-combined list of column filters → a Drizzle `WHERE` (or undefined). */
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

/** Recursive and/or/not tree → a Drizzle `WHERE` (or undefined). */
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
