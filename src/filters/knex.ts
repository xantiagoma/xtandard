/**
 * Knex adapter — renders the portable filter AST to raw parameterized SQL and
 * applies it via `whereRaw`. **PostgreSQL flavor**: `ILIKE` and the `array` ops
 * (`@>`/`<@`/`&&`) are PG-specific — the `array` kind is not supported on
 * MySQL/SQLite. No `knex` import: any object with `whereRaw(sql, bindings)` works,
 * keeping Knex your app's dependency. Column identifiers are server-owned and
 * validated; values are bound (`?`).
 *
 * @example
 * ```ts
 * import { applyFiltersToKnex, textField, numberField } from "@xtandard/lib/filters/knex";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const rows = await applyFiltersToKnex(knex("tasks"), { spec, filters, resolveDate });
 * // or: const { sql, bindings } = buildWhereSql({ spec, filters }) ?? {}; query.whereRaw(sql, bindings);
 * ```
 */

import {
  compileFilterNode,
  compileFilters,
  type DateFilterResolver,
  sqlTextOp,
} from "./compile.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FieldKind, FilterNode } from "./types.ts";

export type KnexFieldSpec = { kind: FieldKind; column: string };
export type KnexFilterSpec = Record<string, KnexFieldSpec>;

const make =
  (kind: FieldKind) =>
  (input: { column: string }): KnexFieldSpec => ({ kind, column: input.column });

export const dateField = make("date");
export const textField = make("text");
export const numberField = make("number");
export const enumField = make("enum");
export const booleanField = make("boolean");
export const arrayField = make("array");

// Server-owned identifiers only: `col` or `table.col` (quoted per part). Never
// pass request data here.
function quoteIdentifier(identifier: string): string {
  const parts = identifier.split(".");
  for (const part of parts) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) {
      throw new Error(`filters/knex: invalid SQL identifier "${identifier}"`);
    }
  }

  return parts.map((p) => `"${p}"`).join(".");
}

type Fragment = { sql: string; bindings: unknown[] };

function condSql(cond: CompiledCond, ident: string): Fragment {
  const col = quoteIdentifier(ident);
  switch (cond.op) {
    case "eq":
      return { sql: `${col} = ?`, bindings: [cond.value] };
    case "ne":
      return { sql: `${col} <> ?`, bindings: [cond.value] };
    case "lt":
      return { sql: `${col} < ?`, bindings: [cond.value] };
    case "gt":
      return { sql: `${col} > ?`, bindings: [cond.value] };
    case "lte":
      return { sql: `${col} <= ?`, bindings: [cond.value] };
    case "gte":
      return { sql: `${col} >= ?`, bindings: [cond.value] };
    case "contains":
    case "startsWith":
    case "endsWith":
    case "like":
    case "ilike":
    case "notIlike": {
      const { op, pattern } = sqlTextOp(cond.op, cond.value);
      const sqlOp = op === "like" ? "LIKE" : op === "ilike" ? "ILIKE" : "NOT ILIKE";

      return { sql: `${col} ${sqlOp} ?`, bindings: [pattern] };
    }
    case "inArray":
    case "notInArray": {
      const placeholders = cond.values.map(() => "?").join(", ");
      const kw = cond.op === "inArray" ? "IN" : "NOT IN";

      return { sql: `${col} ${kw} (${placeholders})`, bindings: [...cond.values] };
    }
    case "arrayContains":
      return { sql: `${col} @> ?`, bindings: [cond.values] };
    case "arrayContained":
      return { sql: `${col} <@ ?`, bindings: [cond.values] };
    case "arrayOverlaps":
      return { sql: `${col} && ?`, bindings: [cond.values] };
    case "isNull":
      return { sql: `${col} IS NULL`, bindings: [] };
    case "isNotNull":
      return { sql: `${col} IS NOT NULL`, bindings: [] };
  }
}

/** Render a portable {@link CompiledWhere} to parameterized SQL (or `null`). */
export function toFilterWhereSql(input: {
  where: CompiledWhere | null;
  columns: Record<string, string>;
}): Fragment | null {
  const render = (node: CompiledWhere): Fragment | undefined => {
    switch (node.type) {
      case "cond": {
        const ident = input.columns[node.cond.field];

        return ident === undefined ? undefined : condSql(node.cond, ident);
      }
      case "and":
      case "or": {
        const parts = node.nodes.map(render).filter((p): p is Fragment => p !== undefined);
        if (parts.length === 0) return undefined;

        return {
          sql: `(${parts.map((p) => p.sql).join(node.type === "and" ? " AND " : " OR ")})`,
          bindings: parts.flatMap((p) => p.bindings),
        };
      }
      case "not": {
        const inner = render(node.node);

        return inner === undefined
          ? undefined
          : { sql: `NOT (${inner.sql})`, bindings: inner.bindings };
      }
    }
  };

  const out = input.where ? render(input.where) : undefined;

  return out ?? null;
}

const columnsOf = (spec: KnexFilterSpec): Record<string, string> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.column]));
const kindsOf = (spec: KnexFilterSpec): Record<string, FieldKind> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.kind]));

/** Flat AND list → `{ sql, bindings }` (or `null`). */
export function buildWhereSql(input: {
  spec: KnexFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): Fragment | null {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return toFilterWhereSql({ where, columns: columnsOf(input.spec) });
}

/** Minimal structural Knex query (no `knex` import). */
export type KnexFilterQuery = { whereRaw(sql: string, bindings?: unknown[]): unknown };

/** Apply a portable filter `WHERE` to a Knex query builder via `whereRaw`. */
export function applyFiltersToKnex<Q extends KnexFilterQuery>(
  query: Q,
  input: { spec: KnexFilterSpec; filters: ColumnFilter[]; resolveDate?: DateFilterResolver },
): Q {
  const fragment = buildWhereSql(input);
  if (fragment) query.whereRaw(fragment.sql, fragment.bindings);

  return query;
}

/** Recursive and/or/not tree → `{ sql, bindings }` (or `null`). */
export function buildFilterNodeSql(input: {
  spec: KnexFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): Fragment | null {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return toFilterWhereSql({ where, columns: columnsOf(input.spec) });
}
