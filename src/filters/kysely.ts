/**
 * Kysely adapter — renders the portable filter AST to a Kysely raw boolean
 * expression. **PostgreSQL flavor**: `ilike` and the `array` ops (`@>`/`<@`/`&&`)
 * are PG-specific — the `array` kind is not supported on MySQL/SQLite. Peer `kysely`.
 * String columns are passed to `sql.ref` (server-owned identifiers); computed
 * values use the `sql` tag. Validation-library-free.
 *
 * @example
 * ```ts
 * import { buildWhere, buildOrderBy, textField, dateField } from "@xtandard/lib/filters/kysely";
 *
 * const spec = { name: textField({ column: "posts.name" }), createdAt: dateField({ column: "posts.created_at" }) };
 * const { where } = buildWhere({ spec, filters, resolveDate });
 * let q = db.selectFrom("posts").selectAll();
 * if (where) q = q.where(where);
 * for (const o of buildOrderBy({ sort, columns: { name: "posts.name" } }).orderBy) q = q.orderBy(o);
 * ```
 */

import { sql, type RawBuilder, type SqlBool } from "kysely";

import {
  compileFilterNode,
  compileFilters,
  type DateFilterResolver,
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

export type KyselyTarget = string | RawBuilder<unknown>;
export type KyselyFieldSpec = { kind: FieldKind; column: KyselyTarget };
export type KyselyFilterSpec = Record<string, KyselyFieldSpec>;

const field =
  (kind: FieldKind) =>
  (input: { column: KyselyTarget }): KyselyFieldSpec => ({ kind, column: input.column });

export const dateField = field("date");
export const textField = field("text");
export const numberField = field("number");
export const enumField = field("enum");
export const booleanField = field("boolean");
export const arrayField = field("array");

const ref = (col: KyselyTarget): RawBuilder<unknown> =>
  typeof col === "string" ? sql.ref(col) : col;

function condSql(cond: CompiledCond, col: RawBuilder<unknown>): RawBuilder<SqlBool> {
  switch (cond.op) {
    case "eq":
      return sql<SqlBool>`${col} = ${cond.value}`;
    case "ne":
      return sql<SqlBool>`${col} <> ${cond.value}`;
    case "lt":
      return sql<SqlBool>`${col} < ${cond.value}`;
    case "gt":
      return sql<SqlBool>`${col} > ${cond.value}`;
    case "lte":
      return sql<SqlBool>`${col} <= ${cond.value}`;
    case "gte":
      return sql<SqlBool>`${col} >= ${cond.value}`;
    case "contains":
    case "startsWith":
    case "endsWith":
    case "like":
    case "ilike":
    case "notIlike": {
      const { op, pattern } = sqlTextOp(cond.op, cond.value);
      if (op === "like") return sql<SqlBool>`${col} like ${pattern}`;
      if (op === "ilike") return sql<SqlBool>`${col} ilike ${pattern}`;

      return sql<SqlBool>`${col} not ilike ${pattern}`;
    }
    case "inArray":
      return sql<SqlBool>`${col} in (${sql.join(cond.values)})`;
    case "notInArray":
      return sql<SqlBool>`${col} not in (${sql.join(cond.values)})`;
    case "arrayContains":
      return sql<SqlBool>`${col} @> ${cond.values}`;
    case "arrayContained":
      return sql<SqlBool>`${col} <@ ${cond.values}`;
    case "arrayOverlaps":
      return sql<SqlBool>`${col} && ${cond.values}`;
    case "isNull":
      return sql<SqlBool>`${col} is null`;
    case "isNotNull":
      return sql<SqlBool>`${col} is not null`;
  }
}

/** Render a portable {@link CompiledWhere} to a Kysely boolean expression. */
export function toKyselyWhere(input: {
  where: CompiledWhere | null;
  columns: Record<string, KyselyTarget>;
}): RawBuilder<SqlBool> | undefined {
  const render = (node: CompiledWhere): RawBuilder<SqlBool> | undefined => {
    switch (node.type) {
      case "cond": {
        const col = input.columns[node.cond.field];

        return col === undefined ? undefined : condSql(node.cond, ref(col));
      }
      case "and":
      case "or": {
        const parts = node.nodes
          .map(render)
          .filter((p): p is RawBuilder<SqlBool> => p !== undefined);
        if (parts.length === 0) return undefined;

        return sql<SqlBool>`(${sql.join(parts, node.type === "and" ? sql` and ` : sql` or `)})`;
      }
      case "not": {
        const inner = render(node.node);

        return inner === undefined ? undefined : sql<SqlBool>`not (${inner})`;
      }
    }
  };

  return input.where ? render(input.where) : undefined;
}

const columnsOf = (spec: KyselyFilterSpec): Record<string, KyselyTarget> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.column]));
const kindsOf = (spec: KyselyFilterSpec): Record<string, FieldKind> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.kind]));

/** Flat AND list → a Kysely boolean expression (or undefined). */
export function buildWhere(input: {
  spec: KyselyFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): { where: RawBuilder<SqlBool> | undefined } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return { where: toKyselyWhere({ where, columns: columnsOf(input.spec) }) };
}

/** Recursive and/or/not tree → a Kysely boolean expression (or undefined). */
export function buildFilterNode(input: {
  spec: KyselyFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): { where: RawBuilder<SqlBool> | undefined } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return { where: toKyselyWhere({ where, columns: columnsOf(input.spec) }) };
}

/** Render a `Sort` to Kysely `orderBy` expressions, allow-listed to `columns`. */
export function buildOrderBy(input: {
  sort: Sort;
  columns: Record<string, KyselyTarget>;
  defaultSort?: Sort;
}): { orderBy: RawBuilder<unknown>[] } {
  const resolve = (sort: Sort): RawBuilder<unknown>[] =>
    sort.flatMap((item) => {
      const col = input.columns[item.field];
      if (col === undefined) return [];

      return [item.dir === "asc" ? sql`${ref(col)} asc` : sql`${ref(col)} desc`];
    });

  const ordered = resolve(input.sort);

  return { orderBy: ordered.length > 0 ? ordered : resolve(input.defaultSort ?? []) };
}
