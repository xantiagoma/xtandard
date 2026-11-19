import {
  compileFilterNode,
  compileFilters,
  type DateFilterResolver,
  type SqlDialect,
  sqlTextOp,
} from "./compile.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FieldKind, FilterNode } from "./types.ts";

export type { SqlDialect } from "./compile.ts";

/** One allow-listed field: its filter kind plus the SQL column (`col` or `table.col`) it reads. */
export type KnexFieldSpec = { kind: FieldKind; column: string };
/** A resource's filter allow-list: public field name → {@link KnexFieldSpec}. */
export type KnexFilterSpec = Record<string, KnexFieldSpec>;

const make =
  (kind: FieldKind) =>
  (input: { column: string }): KnexFieldSpec => ({ kind, column: input.column });

/**
 * Allow-list a public field as a `date` filter over a timestamp column, named by a column
 * string (`"created_at"` or `"posts.created_at"`, quoted per part; anything else throws). A
 * `date` preset needs the `resolveDate` you pass to `buildWhereSql`, and becomes a half-open
 * `[start, end)` window.
 *
 * @example
 * ```ts
 * import { buildWhereSql, dateField } from "@xtandard/lib/filters/knex";
 *
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") });
 * buildWhereSql({
 *   spec: { createdAt: dateField({ column: "posts.created_at" }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * })?.sql;
 * // → '("posts"."created_at" >= ? AND "posts"."created_at" < ?)'
 * ```
 */
export const dateField = make("date");
/**
 * Allow-list a public field as a `text` filter over a string column, named by a column string
 * (`"name"` or `"users.name"`, quoted per part; anything else throws). `contains`/`startsWith`/
 * `endsWith` render as `ILIKE` on Postgres and `LIKE` on MySQL/SQLite, with the input's
 * `%`/`_`/`\` escaped (plus an `ESCAPE` clause on MySQL/SQLite, so they match literally).
 *
 * @example
 * ```ts
 * import { buildWhereSql, textField } from "@xtandard/lib/filters/knex";
 *
 * buildWhereSql({
 *   spec: { name: textField({ column: "users.name" }) },
 *   filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "ann" } }],
 * });
 * // → { sql: '"users"."name" ILIKE ?', bindings: ["%ann%"] }
 * ```
 */
export const textField = make("text");
/**
 * Allow-list a public field as a `number` filter over a numeric column, named by a column
 * string (`"total"` or `"orders.total"`). `between` renders as `>= ? AND <= ?`.
 *
 * @example
 * ```ts
 * import { buildWhereSql, numberField } from "@xtandard/lib/filters/knex";
 *
 * buildWhereSql({
 *   spec: { total: numberField({ column: "orders.total" }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } }],
 * });
 * // → { sql: '("orders"."total" >= ? AND "orders"."total" <= ?)', bindings: [10, 20] }
 * ```
 */
export const numberField = make("number");
/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null checks)
 * over a column named by a column string (`"status"` or `"tasks.status"`).
 *
 * @example
 * ```ts
 * import { buildWhereSql, enumField } from "@xtandard/lib/filters/knex";
 *
 * buildWhereSql({
 *   spec: { status: enumField({ column: "tasks.status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "done"] } }],
 * });
 * // → { sql: '"tasks"."status" IN (?, ?)', bindings: ["open", "done"] }
 * ```
 */
export const enumField = make("enum");
/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a column named
 * by a column string (`"done"` or `"tasks.done"`).
 *
 * @example
 * ```ts
 * import { booleanField, buildWhereSql } from "@xtandard/lib/filters/knex";
 *
 * buildWhereSql({
 *   spec: { done: booleanField({ column: "tasks.done" }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "eq", value: false } }],
 * });
 * // → { sql: '"tasks"."done" = ?', bindings: [false] }
 * ```
 */
export const booleanField = make("boolean");
/**
 * Allow-list a public field as an `array` filter over a column named by a column string
 * (`"tags"` or `"posts.tags"`). The SQL depends on `dialect`: a native array with `@>`/`<@`/`&&`
 * on Postgres, a JSON column with `JSON_CONTAINS`/`JSON_OVERLAPS` on MySQL, and `json_each(…)`
 * subqueries on SQLite.
 *
 * @example
 * ```ts
 * import type { ColumnFilter } from "@xtandard/lib/filters";
 * import { arrayField, buildWhereSql } from "@xtandard/lib/filters/knex";
 *
 * const spec = { tags: arrayField({ column: "posts.tags" }) };
 * const filters: ColumnFilter[] = [
 *   { field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] } },
 * ];
 * buildWhereSql({ spec, filters });
 * // → { sql: '"posts"."tags" && ?', bindings: [["ts", "js"]] }
 * buildWhereSql({ spec, filters, dialect: "mysql" });
 * // → { sql: "JSON_OVERLAPS(`posts`.`tags`, ?)", bindings: ['["ts","js"]'] }
 * ```
 */
export const arrayField = make("array");

// Server-owned identifiers only: `col` or `table.col` (quoted per part). Never
// pass request data here. MySQL reads "x" as a string literal (unless ANSI_QUOTES),
// so it gets backticks.
function quoteIdentifier(identifier: string, dialect: SqlDialect): string {
  const parts = identifier.split(".");
  for (const part of parts) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) {
      throw new Error(`filters/knex: invalid SQL identifier "${identifier}"`);
    }
  }
  const quote = dialect === "mysql" ? "`" : '"';

  return parts.map((p) => `${quote}${p}${quote}`).join(".");
}

// `escapeLike` escapes with a backslash. That is Postgres's default LIKE escape (no clause
// needed); SQLite has no default escape and MySQL drops its default under
// NO_BACKSLASH_ESCAPES, so both name it. CHAR(92) is `\` in every MySQL sql_mode, where a
// '\\' literal changes meaning with NO_BACKSLASH_ESCAPES.
const LIKE_ESCAPE: Record<SqlDialect, string> = {
  postgres: "",
  mysql: " ESCAPE CHAR(92)",
  sqlite: " ESCAPE '\\'",
};

/** A rendered SQL fragment with its positional `?` bindings. */
export type Fragment = { sql: string; bindings: unknown[] };

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
  const col = quoteIdentifier(ident, dialect);
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

      return { sql: `${col} ${sqlOp} ?${LIKE_ESCAPE[dialect]}`, bindings: [pattern] };
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

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to a parameterized `{ sql, bindings }`
 * fragment, looking each field up in `columns` (column strings, validated and quoted).
 * Conditions on fields missing from `columns` are dropped; `null` (or an AST that drops to
 * nothing) gives `null`. Most code calls `buildWhereSql`, which compiles and renders in one step.
 *
 * @example
 * ```ts
 * import { toFilterWhereSql } from "@xtandard/lib/filters/knex";
 *
 * toFilterWhereSql({
 *   where: { type: "and", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "cond", cond: { field: "name", op: "isNotNull" } },
 *   ] },
 *   columns: { amount: "amount", name: "name" },
 * });
 * // → { sql: '("amount" > ? AND "name" IS NOT NULL)', bindings: [5] }
 * ```
 */
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

/**
 * Compile a flat, AND-combined list of column filters into a parameterized
 * `{ sql, bindings }` fragment for Knex's `whereRaw` (or any driver that takes `?`
 * placeholders). Only fields in `spec` whose kind matches the filter's `kind` are kept; the
 * rest are silently dropped. Returns `null` when nothing survives. A `date` preset filter needs
 * `resolveDate` (it throws without one). `dialect` (default `"postgres"`) changes the `array`
 * ops, `ilike`, the `LIKE` escape clause and identifier quoting (backticks on MySQL).
 *
 * @example
 * ```ts
 * import type { ColumnFilter } from "@xtandard/lib/filters";
 * import { buildWhereSql, numberField, textField } from "@xtandard/lib/filters/knex";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const filters: ColumnFilter[] = [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ];
 * buildWhereSql({ spec, filters }); // → { sql: '("name" ILIKE ? AND "amount" >= ?)', bindings: ["Re%", 100] }
 * buildWhereSql({ spec, filters, dialect: "mysql" })?.sql;
 * // → '(`name` LIKE ? ESCAPE CHAR(92) AND `amount` >= ?)'
 * buildWhereSql({ spec, filters: [] }); // → null
 * ```
 */
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

/**
 * Compile `filters` with {@link buildWhereSql} and add the result to a Knex query builder with
 * `query.whereRaw(sql, bindings)`. When no filter survives the allow-list, `whereRaw` is not
 * called. Returns the same `query` for chaining. Works with any object that has a
 * `whereRaw(sql, bindings)` method, so this module never imports `knex`.
 *
 * @example
 * ```ts
 * import type { ColumnFilter } from "@xtandard/lib/filters";
 * import { applyFiltersToKnex, numberField, textField } from "@xtandard/lib/filters/knex";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const filters: ColumnFilter[] = [{ field: "amount", filter: { kind: "number", operator: "gte", value: 100 } }];
 * // in an app: const rows = await applyFiltersToKnex(knex("tasks").select("*"), { spec, filters });
 * const calls: unknown[] = [];
 * const query = { whereRaw: (sql: string, bindings?: unknown[]) => calls.push([sql, bindings]) };
 * applyFiltersToKnex(query, { spec, filters }) === query; // → true
 * calls; // → [['"amount" >= ?', [100]]]
 * ```
 */
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

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into a parameterized
 * `{ sql, bindings }` fragment (or `null`). Same allow-list and `dialect` rules as
 * `buildWhereSql`.
 *
 * @example
 * ```ts
 * import { buildFilterNodeSql, numberField, textField } from "@xtandard/lib/filters/knex";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * buildFilterNodeSql({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * // → { sql: '("name" = ? OR NOT ("amount" < ?))', bindings: ["Rent", 0] }
 * // in an app: knex("tasks").whereRaw(fragment.sql, fragment.bindings)
 * ```
 */
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
