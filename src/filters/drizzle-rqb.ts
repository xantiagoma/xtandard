/**
 * Drizzle **RQB v2** adapter — renders the portable filter AST to the relational
 * query builder's plain `where` OBJECT for `db.query.<table>.findMany({ where })`
 * (drizzle v1's RQBv2), NOT a `SQL` for `db.select().where()` (that's the sibling
 * `@xtandard/lib/filters/drizzle`).
 *
 * **No driver dependency** — it emits a plain object that drizzle interprets, so
 * nothing is imported from `drizzle-orm` (and there's no peer). Unlike a raw-SQL
 * `where: { RAW }`, the native object references columns by their schema property
 * key, so drizzle resolves them against the (aliased) root table itself — i.e. it
 * sidesteps the "invalid reference to FROM-clause entry" footgun of feeding raw
 * column SQL into RQB.
 *
 * Operator mapping (1:1 with RQBv2): `eq`/`ne`/`gt`/`gte`/`lt`/`lte`; set →
 * `in`/`notIn`; text-match → `like`/`ilike`/`notIlike` (the ergonomic
 * `contains`/`startsWith`/`endsWith` lower to `ilike` with an escaped `%`
 * pattern); `between`/`notBetween` are already lowered upstream to `gte`+`lte` /
 * `lt`+`gt`; `isNull`/`isNotNull` → `{ isNull: true }`/`{ isNotNull: true }`;
 * scalar-array → `arrayContains`/`arrayContained`/`arrayOverlaps`; tree →
 * `AND`/`OR`/`NOT`.
 *
 * @example
 * ```ts
 * import { buildWhere, textField, dateField } from "@xtandard/lib/filters/drizzle-rqb";
 *
 * // `column` is the RQBv2 schema PROPERTY key (e.g. "createdAt"), not the SQL column name.
 * const spec = { name: textField({ column: "name" }), createdAt: dateField({ column: "createdAt" }) };
 * const { where } = buildWhere({ spec, filters, resolveDate });
 * const rows = await db.query.tasks.findMany({ where, limit: 20 });
 * ```
 */

import {
  compileFilterNode,
  compileFilters,
  type DateFilterResolver,
  sqlTextOp,
} from "./compile.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FieldKind, FilterNode } from "./types.ts";

export type DrizzleRqbFieldSpec = { kind: FieldKind; column: string };
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

export const dateField = make("date");
export const textField = make("text");
export const numberField = make("number");
export const enumField = make("enum");
export const booleanField = make("boolean");
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

/** Render a portable {@link CompiledWhere} to an RQBv2 `where` object. */
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

/** Flat AND list → an RQBv2 `where` object (or undefined). */
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

/** Recursive and/or/not tree → an RQBv2 `where` object (or undefined). */
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
