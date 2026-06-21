/**
 * Knex adapter — renders the portable filter AST to raw parameterized SQL and
 * applies it via `whereRaw`. **Dialect-aware** (`dialect`, default `"postgres"`):
 * the `array` ops and `ILIKE` are spelled per dialect — PG native `@>`/`<@`/`&&`
 * + `ILIKE`, MySQL `JSON_CONTAINS`/`JSON_OVERLAPS` + `LIKE`, SQLite
 * `json_each(…)` subqueries + `LIKE` (see {@link SqlDialect}). No `knex` import:
 * any object with `whereRaw(sql, bindings)` works, keeping Knex your app's
 * dependency. Column identifiers are server-owned and validated; values are
 * bound (`?`).
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
  type SqlDialect,
  sqlTextOp,
} from "./compile.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FieldKind, FilterNode } from "./types.ts";

export type { SqlDialect } from "./compile.ts";

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

// The `array` ops have no portable spelling — render per dialect. PG uses the
// native set operators (the array binds directly); MySQL the JSON functions
// (JSON-typed column, 8.0.17+ for JSON_OVERLAPS); SQLite a json_each(…) subquery
// (JSON1, bundled since 3.38). `col` is already a quoted identifier; the
// candidate array binds as a JSON string for MySQL/SQLite.
function arrayOpSql(
  op: "arrayContains" | "arrayContained" | "arrayOverlaps",
  col: string,
  values: (string | number)[],
  dialect: SqlDialect,
): Fragment {
  if (dialect === "postgres") {
    if (op === "arrayContains") return { sql: `${col} @> ?`, bindings: [values] };
    if (op === "arrayContained") return { sql: `${col} <@ ?`, bindings: [values] };

    return { sql: `${col} && ?`, bindings: [values] };
  }

  const json = JSON.stringify(values);

  if (dialect === "mysql") {
    if (op === "arrayContains") return { sql: `JSON_CONTAINS(${col}, ?)`, bindings: [json] };
    if (op === "arrayContained") return { sql: `JSON_CONTAINS(?, ${col})`, bindings: [json] };

    return { sql: `JSON_OVERLAPS(${col}, ?)`, bindings: [json] };
  }

  // sqlite — every element of A is in B ⇔ no element of A is absent from B.
  if (op === "arrayContains") {
    return {
      sql: `NOT EXISTS (SELECT 1 FROM json_each(?) je WHERE je.value NOT IN (SELECT value FROM json_each(${col})))`,
      bindings: [json],
    };
  }
  if (op === "arrayContained") {
    return {
      sql: `NOT EXISTS (SELECT 1 FROM json_each(${col}) je WHERE je.value NOT IN (SELECT value FROM json_each(?)))`,
      bindings: [json],
    };
  }

  return {
    sql: `EXISTS (SELECT 1 FROM json_each(${col}) je WHERE je.value IN (SELECT value FROM json_each(?)))`,
    bindings: [json],
  };
}

function condSql(cond: CompiledCond, ident: string, dialect: SqlDialect): Fragment {
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
      // ILIKE is PG-only; on MySQL/SQLite fold to LIKE (case-insensitive by
      // collation / ASCII), the closest portable spelling of the intent.
      const sqlOp =
        op === "like"
          ? "LIKE"
          : op === "ilike"
            ? dialect === "postgres"
              ? "ILIKE"
              : "LIKE"
            : dialect === "postgres"
              ? "NOT ILIKE"
              : "NOT LIKE";

      return { sql: `${col} ${sqlOp} ?`, bindings: [pattern] };
    }
    case "inArray":
    case "notInArray": {
      const placeholders = cond.values.map(() => "?").join(", ");
      const kw = cond.op === "inArray" ? "IN" : "NOT IN";

      return { sql: `${col} ${kw} (${placeholders})`, bindings: [...cond.values] };
    }
    case "arrayContains":
    case "arrayContained":
    case "arrayOverlaps":
      return arrayOpSql(cond.op, col, cond.values, dialect);
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
  dialect?: SqlDialect;
}): Fragment | null {
  const dialect = input.dialect ?? "postgres";
  const render = (node: CompiledWhere): Fragment | undefined => {
    switch (node.type) {
      case "cond": {
        const ident = input.columns[node.cond.field];

        return ident === undefined ? undefined : condSql(node.cond, ident, dialect);
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
  dialect?: SqlDialect;
}): Fragment | null {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return toFilterWhereSql({ where, columns: columnsOf(input.spec), dialect: input.dialect });
}

/** Minimal structural Knex query (no `knex` import). */
export type KnexFilterQuery = { whereRaw(sql: string, bindings?: unknown[]): unknown };

/** Apply a portable filter `WHERE` to a Knex query builder via `whereRaw`. */
export function applyFiltersToKnex<Q extends KnexFilterQuery>(
  query: Q,
  input: {
    spec: KnexFilterSpec;
    filters: ColumnFilter[];
    resolveDate?: DateFilterResolver;
    dialect?: SqlDialect;
  },
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
  dialect?: SqlDialect;
}): Fragment | null {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return toFilterWhereSql({ where, columns: columnsOf(input.spec), dialect: input.dialect });
}
