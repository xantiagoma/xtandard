import type { AnyColumn, SQL } from "drizzle-orm";

import {
  and,
  arrayContained,
  arrayContains,
  arrayOverlaps,
  between,
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
  notBetween,
  notIlike,
  notInArray,
  or,
} from "drizzle-orm";
import { match } from "ts-pattern";

import type {
  ArrayFilter,
  BooleanFilter,
  ColumnFilter,
  DateFilter,
  DatePreset,
  EnumFilter,
  FieldFilter,
  FilterNode,
  NumberFilter,
  TextFilter,
} from "../model.ts";
import type { ColumnOf, FieldSpec, FilterSpec } from "./spec.ts";

/**
 * Compile filters into a Drizzle `SQL` `WHERE`. Two entry points: `buildWhere`
 * for the flat AND-list (the common case) and `buildFilterNode` for the
 * recursive and/or/not tree. Each operator maps to its Drizzle equivalent
 * (https://orm.drizzle.team/docs/operators); the `date` PRESET is resolved to a
 * half-open `[gte, lt)` instant window by an INJECTED `resolveDate` (the
 * DST-aware resolution is app-specific — pass e.g. demi.casa's
 * `@demi.casa/time` `resolveDateFilter`). No casts — the `match` arms carry the
 * correctly-typed column from the spec.
 */

/** Resolve a `date`-preset filter to half-open `[start, end)` instant bounds. */
export type DateFilterResolver = (input: { value: DatePreset }) => {
  start: Date | null;
  end: Date | null;
};

// Postgres LIKE/ILIKE wildcards must be escaped for the ergonomic
// contains/startsWith/endsWith affordances (default escape char is backslash).
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function dateConditions(
  column: ColumnOf<Date>,
  filter: DateFilter,
  resolveDate: DateFilterResolver | undefined,
): SQL[] {
  if (!("anchor" in filter)) {
    return [filter.operator === "isNull" ? isNull(column) : isNotNull(column)];
  }

  if (!resolveDate) {
    throw new Error(
      "buildWhere: a `date` preset filter requires a `resolveDate` resolver (none provided).",
    );
  }

  const { start, end } = resolveDate({ value: filter });
  const out: SQL[] = [];
  if (start) out.push(gte(column, start));
  if (end) out.push(lt(column, end));

  return out;
}

function textConditions(column: ColumnOf<string>, filter: TextFilter): SQL[] {
  if ("values" in filter) {
    return [
      filter.operator === "inArray"
        ? inArray(column, filter.values)
        : notInArray(column, filter.values),
    ];
  }

  if ("value" in filter) {
    const value = filter.value;

    return [
      match(filter.operator)
        .with("eq", () => eq(column, value))
        .with("ne", () => ne(column, value))
        .with("contains", () => ilike(column, `%${escapeLike(value)}%`))
        .with("startsWith", () => ilike(column, `${escapeLike(value)}%`))
        .with("endsWith", () => ilike(column, `%${escapeLike(value)}`))
        .with("like", () => like(column, value))
        .with("ilike", () => ilike(column, value))
        .with("notIlike", () => notIlike(column, value))
        .exhaustive(),
    ];
  }

  return [filter.operator === "isNull" ? isNull(column) : isNotNull(column)];
}

function numberConditions(column: ColumnOf<number>, filter: NumberFilter): SQL[] {
  if ("from" in filter) {
    return [
      filter.operator === "between"
        ? between(column, filter.from, filter.to)
        : notBetween(column, filter.from, filter.to),
    ];
  }

  if ("values" in filter) {
    return [
      filter.operator === "inArray"
        ? inArray(column, filter.values)
        : notInArray(column, filter.values),
    ];
  }

  if ("value" in filter) {
    const value = filter.value;

    return [
      match(filter.operator)
        .with("eq", () => eq(column, value))
        .with("ne", () => ne(column, value))
        .with("lt", () => lt(column, value))
        .with("gt", () => gt(column, value))
        .with("lte", () => lte(column, value))
        .with("gte", () => gte(column, value))
        .exhaustive(),
    ];
  }

  return [filter.operator === "isNull" ? isNull(column) : isNotNull(column)];
}

function enumConditions(column: ColumnOf<string>, filter: EnumFilter): SQL[] {
  if ("values" in filter) {
    return [
      filter.operator === "inArray"
        ? inArray(column, filter.values)
        : notInArray(column, filter.values),
    ];
  }

  if ("value" in filter) {
    return [filter.operator === "eq" ? eq(column, filter.value) : ne(column, filter.value)];
  }

  return [filter.operator === "isNull" ? isNull(column) : isNotNull(column)];
}

function booleanConditions(column: ColumnOf<boolean>, filter: BooleanFilter): SQL[] {
  if ("value" in filter) {
    return [filter.operator === "eq" ? eq(column, filter.value) : ne(column, filter.value)];
  }

  return [filter.operator === "isNull" ? isNull(column) : isNotNull(column)];
}

function arrayConditions(column: AnyColumn, filter: ArrayFilter): SQL[] {
  if ("values" in filter) {
    return [
      match(filter.operator)
        .with("arrayContains", () => arrayContains(column, filter.values))
        .with("arrayContained", () => arrayContained(column, filter.values))
        .with("arrayOverlaps", () => arrayOverlaps(column, filter.values))
        .exhaustive(),
    ];
  }

  return [filter.operator === "isNull" ? isNull(column) : isNotNull(column)];
}

/** All SQL conditions for one (spec, filter) pair. A kind mismatch yields none. */
function conditionsFor(input: {
  spec: FieldSpec;
  filter: FieldFilter;
  resolveDate: DateFilterResolver | undefined;
}): SQL[] {
  return match({ spec: input.spec, filter: input.filter })
    .with({ spec: { kind: "date" }, filter: { kind: "date" } }, (m) =>
      dateConditions(m.spec.column, m.filter, input.resolveDate),
    )
    .with({ spec: { kind: "text" }, filter: { kind: "text" } }, (m) =>
      textConditions(m.spec.column, m.filter),
    )
    .with({ spec: { kind: "number" }, filter: { kind: "number" } }, (m) =>
      numberConditions(m.spec.column, m.filter),
    )
    .with({ spec: { kind: "enum" }, filter: { kind: "enum" } }, (m) =>
      enumConditions(m.spec.column, m.filter),
    )
    .with({ spec: { kind: "boolean" }, filter: { kind: "boolean" } }, (m) =>
      booleanConditions(m.spec.column, m.filter),
    )
    .with({ spec: { kind: "array" }, filter: { kind: "array" } }, (m) =>
      arrayConditions(m.spec.column, m.filter),
    )
    .otherwise(() => []);
}

function isSql(value: SQL | undefined): value is SQL {
  return value !== undefined;
}

/** Flat AND-combined list of column filters → a single `WHERE` (or undefined). */
export function buildWhere(input: {
  spec: FilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): {
  where: SQL | undefined;
} {
  const conditions: SQL[] = [];

  for (const columnFilter of input.filters) {
    const fieldSpec = input.spec[columnFilter.field];
    if (!fieldSpec) continue; // not allow-listed → dropped

    conditions.push(
      ...conditionsFor({
        spec: fieldSpec,
        filter: columnFilter.filter,
        resolveDate: input.resolveDate,
      }),
    );
  }

  return { where: conditions.length > 0 ? and(...conditions) : undefined };
}

function nodeToSql(
  spec: FilterSpec,
  node: FilterNode,
  resolveDate: DateFilterResolver | undefined,
): SQL | undefined {
  return match(node)
    .with({ type: "column" }, (n) => {
      const fieldSpec = spec[n.field];
      if (!fieldSpec) return undefined;

      const conditions = conditionsFor({ spec: fieldSpec, filter: n.filter, resolveDate });

      return conditions.length > 0 ? and(...conditions) : undefined;
    })
    .with({ type: "and" }, (n) =>
      and(...n.nodes.map((c) => nodeToSql(spec, c, resolveDate)).filter(isSql)),
    )
    .with({ type: "or" }, (n) =>
      or(...n.nodes.map((c) => nodeToSql(spec, c, resolveDate)).filter(isSql)),
    )
    .with({ type: "not" }, (n) => {
      const inner = nodeToSql(spec, n.node, resolveDate);

      return inner ? not(inner) : undefined;
    })
    .exhaustive();
}

/** Recursive and/or/not tree → a single `WHERE` (or undefined). */
export function buildFilterNode(input: {
  spec: FilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): {
  where: SQL | undefined;
} {
  return { where: nodeToSql(input.spec, input.node, input.resolveDate) };
}
