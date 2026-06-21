/**
 * Drizzle **relational query builder** adapters — render the portable filter AST
 * to what `db.query.<table>.findMany` accepts, NOT a `SQL` for
 * `db.select().where()` (that's the sibling `@xtandard/lib/filters/drizzle`).
 * Two flavors:
 *
 * - **RQB v2** (drizzle v1, `db.query`): `where` is a plain OBJECT —
 *   `buildWhere`/`buildFilterNode`/`toDrizzleRqbWhere`.
 * - **RQB v1** (legacy, `db._query` / drizzle 0.x `db.query`): `where` is a
 *   CALLBACK `(fields, operators) => SQL` — `buildRqbV1Where`/
 *   `buildRqbV1FilterNode`/`toDrizzleRqbV1Callback`. It builds via the
 *   callback-provided `operators` and `fields`, so column refs resolve against
 *   the RQB's aliased table (no raw-SQL alias footgun).
 *
 * Both are **driver-free** (no `drizzle-orm` import, no peer): v2 emits a plain
 * object; v1 emits a callback that consumes the operators drizzle passes in.
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

// ── RQB v1 (legacy callback `where: (fields, operators) => SQL`) ──────────────

/**
 * The drizzle operators the RQB **v1** `where` callback receives as its second
 * argument (`(fields, operators) => …`). Structural + generic over the SQL type
 * `R` so this adapter imports no `drizzle-orm` — drizzle's real operators satisfy
 * it. `and`/`or` may return `undefined` (no conditions), matching drizzle.
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
  arrayContains(column: unknown, values: unknown[]): R;
  arrayContained(column: unknown, values: unknown[]): R;
  arrayOverlaps(column: unknown, values: unknown[]): R;
  and(...conditions: (R | undefined)[]): R | undefined;
  or(...conditions: (R | undefined)[]): R | undefined;
  not(condition: R): R;
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
      return ops.arrayContains(column, cond.values);
    case "arrayContained":
      return ops.arrayContained(column, cond.values);
    case "arrayOverlaps":
      return ops.arrayOverlaps(column, cond.values);
    case "isNull":
      return ops.isNull(column);
    case "isNotNull":
      return ops.isNotNull(column);
  }
}

/** Render a portable {@link CompiledWhere} to an RQB **v1** `where` callback. */
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

/** Flat AND list → an RQB v1 `where` callback. */
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

/** Recursive and/or/not tree → an RQB v1 `where` callback. */
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
