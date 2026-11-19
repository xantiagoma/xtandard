import { sql, type RawBuilder, type SqlBool } from "kysely";

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

export type { SqlDialect } from "./compile.ts";

/** What a field reads: a column reference string (`"name"`, `"posts.name"`, passed to
 * `sql.ref`) or any Kysely raw expression (e.g. `` sql`lower(name)` ``). */
export type KyselyTarget = string | RawBuilder<unknown>;
/** One allow-listed field: its filter kind plus the {@link KyselyTarget} it reads. */
export type KyselyFieldSpec = { kind: FieldKind; column: KyselyTarget };
/** A resource's filter allow-list: public field name → {@link KyselyFieldSpec}. */
export type KyselyFilterSpec = Record<string, KyselyFieldSpec>;

const field =
  (kind: FieldKind) =>
  (input: { column: KyselyTarget }): KyselyFieldSpec => ({ kind, column: input.column });

/**
 * Allow-list a public field as a `date` filter over a timestamp column, given as a Kysely
 * reference string (`"posts.created_at"`) or a raw expression. A `date` preset needs the
 * `resolveDate` you pass to `buildWhere`, and becomes a half-open `[start, end)` window.
 *
 * @example
 * ```ts
 * import { buildWhere, dateField } from "@xtandard/lib/filters/kysely";
 *
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") });
 * const { where } = buildWhere({
 *   spec: { createdAt: dateField({ column: "posts.created_at" }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * });
 * where!.compile(db).sql; // db: your Kysely instance
 * // → '("posts"."created_at" >= $1 and "posts"."created_at" < $2)'
 * ```
 */
export const dateField = field("date");
/**
 * Allow-list a public field as a `text` filter over a string column, given as a Kysely
 * reference string (`"users.name"`) or a raw expression such as `` sql`lower(users.name)` ``.
 * `contains`/`startsWith`/`endsWith` render as `ilike` on Postgres and `like` on MySQL/SQLite,
 * with the input's `%`/`_`/`\` escaped (plus an `escape` clause on MySQL/SQLite, so they match
 * literally).
 *
 * @example
 * ```ts
 * import { buildWhere, textField } from "@xtandard/lib/filters/kysely";
 *
 * const { where } = buildWhere({
 *   spec: { name: textField({ column: "users.name" }) },
 *   filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "ann" } }],
 * });
 * const { sql, parameters } = where!.compile(db); // db: your Kysely instance
 * // sql → '"users"."name" ilike $1', parameters → ["%ann%"]
 * ```
 */
export const textField = field("text");
/**
 * Allow-list a public field as a `number` filter over a numeric column, given as a Kysely
 * reference string (`"orders.total"`) or a raw expression. `between` renders as
 * `>= from and <= to`.
 *
 * @example
 * ```ts
 * import { buildWhere, numberField } from "@xtandard/lib/filters/kysely";
 *
 * const { where } = buildWhere({
 *   spec: { total: numberField({ column: "orders.total" }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } }],
 * });
 * const { sql, parameters } = where!.compile(db); // db: your Kysely instance
 * // sql → '("orders"."total" >= $1 and "orders"."total" <= $2)', parameters → [10, 20]
 * ```
 */
export const numberField = field("number");
/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null checks)
 * over a column given as a Kysely reference string (`"tasks.status"`) or a raw expression.
 *
 * @example
 * ```ts
 * import { buildWhere, enumField } from "@xtandard/lib/filters/kysely";
 *
 * const { where } = buildWhere({
 *   spec: { status: enumField({ column: "tasks.status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "done"] } }],
 * });
 * const { sql, parameters } = where!.compile(db); // db: your Kysely instance
 * // sql → '"tasks"."status" in ($1, $2)', parameters → ["open", "done"]
 * ```
 */
export const enumField = field("enum");
/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a column given
 * as a Kysely reference string (`"tasks.done"`) or a raw expression.
 *
 * @example
 * ```ts
 * import { booleanField, buildWhere } from "@xtandard/lib/filters/kysely";
 *
 * const { where } = buildWhere({
 *   spec: { done: booleanField({ column: "tasks.done" }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "eq", value: false } }],
 * });
 * const { sql, parameters } = where!.compile(db); // db: your Kysely instance
 * // sql → '"tasks"."done" = $1', parameters → [false]
 * ```
 */
export const booleanField = field("boolean");
/**
 * Allow-list a public field as an `array` filter over a column given as a Kysely reference
 * string (`"posts.tags"`) or a raw expression. The SQL depends on `dialect`: a native array
 * with `@>`/`<@`/`&&` on Postgres, a JSON column with `json_contains`/`json_overlaps` on MySQL,
 * and `json_each(…)` subqueries on SQLite.
 *
 * @example
 * ```ts
 * import type { ColumnFilter } from "@xtandard/lib/filters";
 * import { arrayField, buildWhere } from "@xtandard/lib/filters/kysely";
 *
 * const spec = { tags: arrayField({ column: "posts.tags" }) };
 * const filters: ColumnFilter[] = [
 *   { field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] } },
 * ];
 * buildWhere({ spec, filters }).where!.compile(db).sql; // → '"posts"."tags" && $1'
 * buildWhere({ spec, filters, dialect: "mysql" }).where!.compile(db).sql;
 * // → 'json_overlaps("posts"."tags", $1)' with a Postgres `db`;
 * //   a MySQL Kysely instance prints 'json_overlaps(`posts`.`tags`, ?)'
 * ```
 */
export const arrayField = field("array");

const ref = (col: KyselyTarget): RawBuilder<unknown> =>
  typeof col === "string" ? sql.ref(col) : col;

// `escapeLike` escapes with a backslash. That is Postgres's default LIKE escape (no clause
// needed); SQLite has no default escape and MySQL drops its default under
// NO_BACKSLASH_ESCAPES, so both name it. char(92) is `\` in every MySQL sql_mode, where a
// '\\' literal changes meaning with NO_BACKSLASH_ESCAPES.
const LIKE_ESCAPE: Record<SqlDialect, RawBuilder<unknown>> = {
  postgres: sql``,
  mysql: sql` escape char(92)`,
  sqlite: sql` escape '\\'`,
};

// The `array` ops have no portable spelling — render per dialect. PG uses the
// native set operators; MySQL the JSON functions (JSON-typed column, 8.0.17+ for
// JSON_OVERLAPS); SQLite a json_each(…) subquery (JSON1, bundled since 3.38).
// The candidate array is passed as a bound JSON string for MySQL/SQLite.
function arrayOpSql(
  op: "arrayContains" | "arrayContained" | "arrayOverlaps",
  col: RawBuilder<unknown>,
  values: (string | number)[],
  dialect: SqlDialect,
): RawBuilder<SqlBool> {
  if (dialect === "postgres") {
    if (op === "arrayContains") return sql<SqlBool>`${col} @> ${values}`;
    if (op === "arrayContained") return sql<SqlBool>`${col} <@ ${values}`;

    return sql<SqlBool>`${col} && ${values}`;
  }

  const json = JSON.stringify(values);

  if (dialect === "mysql") {
    if (op === "arrayContains") return sql<SqlBool>`json_contains(${col}, ${json})`;
    if (op === "arrayContained") return sql<SqlBool>`json_contains(${json}, ${col})`;

    return sql<SqlBool>`json_overlaps(${col}, ${json})`;
  }

  // sqlite — every element of A is in B ⇔ no element of A is absent from B.
  if (op === "arrayContains") {
    return sql<SqlBool>`not exists (select 1 from json_each(${json}) je where je.value not in (select value from json_each(${col})))`;
  }
  if (op === "arrayContained") {
    return sql<SqlBool>`not exists (select 1 from json_each(${col}) je where je.value not in (select value from json_each(${json})))`;
  }

  return sql<SqlBool>`exists (select 1 from json_each(${col}) je where je.value in (select value from json_each(${json})))`;
}

function condSql(
  cond: CompiledCond,
  col: RawBuilder<unknown>,
  dialect: SqlDialect,
): RawBuilder<SqlBool> {
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
      // ILIKE is PG-only; on MySQL/SQLite fold to LIKE (case-insensitive by
      // collation / ASCII), the closest portable spelling of the intent.
      const keyword =
        op === "like"
          ? sql`like`
          : dialect === "postgres"
            ? op === "ilike"
              ? sql`ilike`
              : sql`not ilike`
            : op === "ilike"
              ? sql`like`
              : sql`not like`;

      return sql<SqlBool>`${col} ${keyword} ${pattern}${LIKE_ESCAPE[dialect]}`;
    }
    case "inArray":
      return sql<SqlBool>`${col} in (${sql.join(cond.values)})`;
    case "notInArray":
      return sql<SqlBool>`${col} not in (${sql.join(cond.values)})`;
    case "arrayContains":
    case "arrayContained":
    case "arrayOverlaps":
      return arrayOpSql(cond.op, col, cond.values, dialect);
    case "isNull":
      return sql<SqlBool>`${col} is null`;
    case "isNotNull":
      return sql<SqlBool>`${col} is not null`;
  }
}

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to a Kysely boolean expression, looking each
 * field up in `columns`. Conditions on fields missing from `columns` are dropped; `null` (or an
 * AST that drops to nothing) gives `undefined`. Most code calls `buildWhere`, which compiles
 * and renders in one step.
 *
 * @example
 * ```ts
 * import { toKyselyWhere } from "@xtandard/lib/filters/kysely";
 *
 * const where = toKyselyWhere({
 *   where: { type: "and", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "cond", cond: { field: "name", op: "isNotNull" } },
 *   ] },
 *   columns: { amount: "tasks.amount", name: "tasks.name" },
 * });
 * const { sql, parameters } = where!.compile(db); // db: your Kysely instance
 * // sql → '("tasks"."amount" > $1 and "tasks"."name" is not null)', parameters → [5]
 * ```
 */
export function toKyselyWhere(input: {
  where: CompiledWhere | null;
  columns: Record<string, KyselyTarget>;
  dialect?: SqlDialect;
}): RawBuilder<SqlBool> | undefined {
  const dialect = input.dialect ?? "postgres";
  const render = (node: CompiledWhere): RawBuilder<SqlBool> | undefined => {
    switch (node.type) {
      case "cond": {
        const col = input.columns[node.cond.field];

        return col === undefined ? undefined : condSql(node.cond, ref(col), dialect);
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

/**
 * Compile a flat, AND-combined list of column filters into a Kysely boolean expression for
 * `.where(where)`. Only fields in `spec` whose kind matches the filter's `kind` are kept; the
 * rest are silently dropped. `where` is `undefined` when nothing survives (skip the `.where`
 * call then). A `date` preset filter needs `resolveDate` (it throws without one). `dialect`
 * (default `"postgres"`) changes the `array` ops, `ilike` and the `LIKE` escape clause.
 *
 * @example
 * ```ts
 * import { buildWhere, numberField, textField } from "@xtandard/lib/filters/kysely";
 *
 * const spec = { name: textField({ column: "tasks.name" }), amount: numberField({ column: "tasks.amount" }) };
 * const { where } = buildWhere({ spec, filters: [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ] });
 * let query = db.selectFrom("tasks").selectAll(); // db: your Kysely instance
 * if (where) query = query.where(where);
 * const { sql, parameters } = query.compile();
 * // sql → 'select * from "tasks" where ("tasks"."name" ilike $1 and "tasks"."amount" >= $2)'
 * // parameters → ["Re%", 100]
 * ```
 */
export function buildWhere(input: {
  spec: KyselyFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
  dialect?: SqlDialect;
}): { where: RawBuilder<SqlBool> | undefined } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return {
    where: toKyselyWhere({ where, columns: columnsOf(input.spec), dialect: input.dialect }),
  };
}

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into a Kysely boolean
 * expression (or `undefined`). Same allow-list and `dialect` rules as `buildWhere`.
 *
 * @example
 * ```ts
 * import { buildFilterNode, numberField, textField } from "@xtandard/lib/filters/kysely";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const { where } = buildFilterNode({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * const { sql, parameters } = where!.compile(db); // db: your Kysely instance
 * // sql → '("name" = $1 or not ("amount" < $2))', parameters → ["Rent", 0]
 * ```
 */
export function buildFilterNode(input: {
  spec: KyselyFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
  dialect?: SqlDialect;
}): { where: RawBuilder<SqlBool> | undefined } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return {
    where: toKyselyWhere({ where, columns: columnsOf(input.spec), dialect: input.dialect }),
  };
}

/**
 * Render a `Sort` to Kysely `orderBy` expressions, allow-listed to `columns` (public field
 * name → {@link KyselyTarget}). Unknown fields are dropped; when nothing is left, `defaultSort`
 * is used instead. Apply each expression with `query.orderBy(expr)`.
 *
 * @example
 * ```ts
 * import { buildOrderBy } from "@xtandard/lib/filters/kysely";
 *
 * const { orderBy } = buildOrderBy({
 *   sort: [{ field: "amount", dir: "desc" }, { field: "password", dir: "asc" }], // password: not sortable
 *   columns: { name: "tasks.name", amount: "tasks.amount" },
 *   defaultSort: [{ field: "name", dir: "asc" }],
 * });
 * let query = db.selectFrom("tasks").selectAll(); // db: your Kysely instance
 * for (const expr of orderBy) query = query.orderBy(expr);
 * query.compile().sql; // → 'select * from "tasks" order by "tasks"."amount" desc'
 * ```
 */
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
