/**
 * The portable compiler: lower the filter model + a kind allow-list into a
 * driver-agnostic {@link CompiledWhere} AST that every adapter renders. No
 * validation library, no driver — pure data in, pure data out.
 *
 * Lowering rules: a non-allow-listed (or kind-mismatched) field is dropped; the
 * `date` preset is resolved to a half-open `[gte, lt)` window via the injected
 * `resolveDate`; `between` → `gte AND lte`, `notBetween` → `lt OR gt` (we never
 * emit SQL `BETWEEN`). Text-match ops stay SEMANTIC — each adapter renders
 * `contains`/`ilike`/… natively (SQL `ILIKE`, Mongo `$regex`, Prisma contains-mode).
 *
 * @example
 * ```ts
 * import { compileFilters } from "@xtandard/lib/filters";
 *
 * const { where } = compileFilters({
 *   spec: { status: "enum", amount: "number" }, // field → kind allow-list
 *   filters: [
 *     { field: "status", filter: { kind: "enum", operator: "inArray", values: ["open"] } },
 *     { field: "secret", filter: { kind: "text", operator: "eq", value: "x" } }, // dropped
 *   ],
 * });
 * // where → { type: "cond", cond: { field: "status", op: "inArray", values: ["open"] } }
 * ```
 */

import type {
  ColumnFilter,
  CompiledCond,
  CompiledWhere,
  DatePreset,
  FieldFilter,
  FieldKind,
  FieldKindSpec,
  FilterNode,
} from "./types.ts";

/** Resolve a `date`-preset filter to half-open `[start, end)` instant bounds. */
export type DateFilterResolver = (input: { value: DatePreset }) => {
  start: Date | null;
  end: Date | null;
};

/**
 * SQL dialect for the SQL adapters (kysely/knex). Affects the ops with no
 * portable spelling (the `array` ops and case-insensitive `ilike`), the `LIKE`
 * `ESCAPE` clause, and knex's identifier quoting (backticks on MySQL). `postgres`
 * (default) uses native `@>`/`<@`/`&&` + `ILIKE`; `mysql` renders the array ops
 * as `JSON_CONTAINS`/`JSON_OVERLAPS` over JSON columns and lowers `ilike` →
 * `LIKE` (case-insensitive by collation); `sqlite` renders the array ops as
 * `json_each(…)` `EXISTS`/`NOT EXISTS` subqueries and lowers `ilike` → `LIKE`
 * (case-insensitive ASCII). MySQL needs JSON-typed columns (8.0.17+ for
 * `JSON_OVERLAPS`); SQLite needs the JSON1 extension (bundled since 3.38).
 */
export type SqlDialect = "postgres" | "mysql" | "sqlite";

/**
 * Escape the `LIKE`/`ILIKE` wildcards (`%`, `_`) and the escape character
 * itself (`\`) with a backslash, so a user's text matches literally — used by
 * the `contains`/`startsWith`/`endsWith` affordances. Backslash is Postgres's
 * default `LIKE` escape; the kysely/knex adapters add an `ESCAPE` clause on
 * SQLite (no default escape) and MySQL (none under `NO_BACKSLASH_ESCAPES`). Using
 * it yourself on SQLite, add `ESCAPE '\'` to your `LIKE`.
 *
 * @example
 * ```ts
 * import { escapeLike } from "@xtandard/lib/filters";
 *
 * escapeLike("50%_off"); // → "50\\%\\_off"  (prints as 50\%\_off)
 * const pattern = `%${escapeLike("50%")}%`; // a literal "50%" anywhere
 * ```
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Lower a semantic text-match op to a SQL `LIKE`/`ILIKE` `(op, pattern)` —
 * shared by the SQL adapters (drizzle/kysely/knex). `contains`/`startsWith`/
 * `endsWith` become `ilike` with an escaped `%` pattern; `like`/`ilike`/
 * `notIlike` pass the pattern through verbatim.
 *
 * @example
 * ```ts
 * import { sqlTextOp } from "@xtandard/lib/filters";
 *
 * sqlTextOp("startsWith", "ada"); // → { op: "ilike", pattern: "ada%" }
 * sqlTextOp("contains", "50%"); // → { op: "ilike", pattern: "%50\\%%" }  (escaped)
 * sqlTextOp("like", "A_%"); // → { op: "like", pattern: "A_%" }  (verbatim)
 * ```
 */
export function sqlTextOp(
  op: "contains" | "startsWith" | "endsWith" | "like" | "ilike" | "notIlike",
  value: string,
): { op: "like" | "ilike" | "notIlike"; pattern: string } {
  switch (op) {
    case "contains":
      return { op: "ilike", pattern: `%${escapeLike(value)}%` };
    case "startsWith":
      return { op: "ilike", pattern: `${escapeLike(value)}%` };
    case "endsWith":
      return { op: "ilike", pattern: `%${escapeLike(value)}` };
    case "like":
      return { op: "like", pattern: value };
    case "ilike":
      return { op: "ilike", pattern: value };
    case "notIlike":
      return { op: "notIlike", pattern: value };
  }
}

const leaf = (cond: CompiledCond): CompiledWhere => ({ type: "cond", cond });

const allOf = (nodes: CompiledWhere[]): CompiledWhere | null =>
  nodes.length === 0 ? null : nodes.length === 1 ? (nodes[0] ?? null) : { type: "and", nodes };

/**
 * Lower one column filter to a {@link CompiledWhere} sub-expression (or `null`).
 * Property-presence narrowing handles the `kind × variant` unions. `between`
 * becomes `gte AND lte` and `notBetween` becomes `lt OR gt` — we never emit SQL
 * `BETWEEN` (its inclusive upper bound is a footgun, especially for timestamps;
 * see https://wiki.postgresql.org/wiki/Don't_Do_This). The `date` preset is
 * resolved to a half-open `[gte, lt)` window via the injected resolver.
 */
function fieldWhere(input: {
  field: string;
  filter: FieldFilter;
  resolveDate: DateFilterResolver | undefined;
}): CompiledWhere | null {
  const { field, filter, resolveDate } = input;

  switch (filter.kind) {
    case "text": {
      if ("values" in filter) return leaf({ field, op: filter.operator, values: filter.values });
      if ("value" in filter) {
        // eq/ne are scalar; contains/startsWith/endsWith/like/ilike/notIlike stay
        // SEMANTIC in the AST (each adapter renders them natively).
        if (filter.operator === "eq" || filter.operator === "ne") {
          return leaf({ field, op: filter.operator, value: filter.value });
        }

        return leaf({ field, op: filter.operator, value: filter.value });
      }

      return leaf({ field, op: filter.operator });
    }
    case "number": {
      if ("from" in filter) {
        return filter.operator === "between"
          ? allOf([
              leaf({ field, op: "gte", value: filter.from }),
              leaf({ field, op: "lte", value: filter.to }),
            ])
          : {
              type: "or",
              nodes: [
                leaf({ field, op: "lt", value: filter.from }),
                leaf({ field, op: "gt", value: filter.to }),
              ],
            };
      }
      if ("values" in filter) return leaf({ field, op: filter.operator, values: filter.values });
      if ("value" in filter) return leaf({ field, op: filter.operator, value: filter.value });
      return leaf({ field, op: filter.operator });
    }
    case "enum": {
      if ("values" in filter) return leaf({ field, op: filter.operator, values: filter.values });
      if ("value" in filter) return leaf({ field, op: filter.operator, value: filter.value });
      return leaf({ field, op: filter.operator });
    }
    case "boolean": {
      if ("value" in filter) return leaf({ field, op: filter.operator, value: filter.value });
      return leaf({ field, op: filter.operator });
    }
    case "array": {
      if ("values" in filter) return leaf({ field, op: filter.operator, values: filter.values });
      return leaf({ field, op: filter.operator });
    }
    case "date": {
      if (!("anchor" in filter)) return leaf({ field, op: filter.operator });

      if (!resolveDate) {
        throw new Error(
          "compileFilters: a `date` preset filter requires a `resolveDate` resolver (none provided).",
        );
      }

      const { start, end } = resolveDate({ value: filter });
      const nodes: CompiledWhere[] = [];
      if (start) nodes.push(leaf({ field, op: "gte", value: start }));
      if (end) nodes.push(leaf({ field, op: "lt", value: end }));

      return allOf(nodes);
    }
  }
}

function kindOf(spec: FieldKindSpec, field: string): FieldKind | undefined {
  return spec[field];
}

/**
 * Compile a flat AND-combined list of column filters into a {@link CompiledWhere}
 * (or `null` when nothing is allow-listed). `spec` is the per-field kind
 * allow-list — a field not in `spec`, or whose filter kind doesn't match, is
 * dropped. A `date` preset needs `resolveDate` (it throws without one).
 *
 * @example
 * ```ts
 * import { compileFilters } from "@xtandard/lib/filters";
 *
 * const { where } = compileFilters({
 *   spec: { status: "enum", amount: "number" }, // field → kind allow-list
 *   filters: [
 *     { field: "status", filter: { kind: "enum", operator: "eq", value: "open" } },
 *     { field: "amount", filter: { kind: "number", operator: "between", from: 10, to: 100 } },
 *     { field: "secret", filter: { kind: "text", operator: "eq", value: "x" } }, // dropped
 *   ],
 * });
 * // where → { type: "and", nodes: [
 * //   { type: "cond", cond: { field: "status", op: "eq", value: "open" } },
 * //   { type: "and", nodes: [
 * //     { type: "cond", cond: { field: "amount", op: "gte", value: 10 } },
 * //     { type: "cond", cond: { field: "amount", op: "lte", value: 100 } },
 * //   ] },
 * // ] }
 * ```
 *
 * @example A date preset, resolved by an injected resolver
 * ```ts
 * const { where } = compileFilters({
 *   spec: { createdAt: "date" },
 *   filters: [{ field: "createdAt", filter: {
 *     kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-02-01T00:00:00",
 *   } }],
 *   resolveDate: () => ({ start: new Date("2026-02-01T00:00:00Z"), end: new Date("2026-03-01T00:00:00Z") }),
 * });
 * // where → { type: "and", nodes: [
 * //   { type: "cond", cond: { field: "createdAt", op: "gte", value: 2026-02-01T00:00:00.000Z } },
 * //   { type: "cond", cond: { field: "createdAt", op: "lt", value: 2026-03-01T00:00:00.000Z } },
 * // ] }
 * ```
 */
export function compileFilters(input: {
  spec: FieldKindSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): { where: CompiledWhere | null } {
  const nodes: CompiledWhere[] = [];

  for (const { field, filter } of input.filters) {
    if (kindOf(input.spec, field) !== filter.kind) continue; // not allow-listed / kind mismatch

    const where = fieldWhere({ field, filter, resolveDate: input.resolveDate });
    if (where) nodes.push(where);
  }

  return { where: allOf(nodes) };
}

function nodeToWhere(
  spec: FieldKindSpec,
  node: FilterNode,
  resolveDate: DateFilterResolver | undefined,
): CompiledWhere | null {
  switch (node.type) {
    case "column": {
      if (kindOf(spec, node.field) !== node.filter.kind) return null;

      return fieldWhere({ field: node.field, filter: node.filter, resolveDate });
    }
    case "and": {
      const nodes = node.nodes
        .map((n) => nodeToWhere(spec, n, resolveDate))
        .filter((w): w is CompiledWhere => w !== null);

      return nodes.length > 0 ? { type: "and", nodes } : null;
    }
    case "or": {
      const nodes = node.nodes
        .map((n) => nodeToWhere(spec, n, resolveDate))
        .filter((w): w is CompiledWhere => w !== null);

      return nodes.length > 0 ? { type: "or", nodes } : null;
    }
    case "not": {
      const inner = nodeToWhere(spec, node.node, resolveDate);

      return inner ? { type: "not", node: inner } : null;
    }
  }
}

/**
 * Compile a recursive and/or/not tree into a {@link CompiledWhere} (or `null`).
 * Non-allow-listed leaves are dropped the same way as in
 * {@link compileFilters}; a group left with no children is dropped too, and a
 * `not` around nothing disappears.
 *
 * @example
 * ```ts
 * import { compileFilterNode } from "@xtandard/lib/filters";
 *
 * const { where } = compileFilterNode({
 *   spec: { status: "enum", amount: "number" },
 *   node: {
 *     type: "or",
 *     nodes: [
 *       { type: "column", field: "status", filter: { kind: "enum", operator: "eq", value: "open" } },
 *       { type: "column", field: "amount", filter: { kind: "number", operator: "notBetween", from: 0, to: 10 } },
 *     ],
 *   },
 * });
 * // where → { type: "or", nodes: [
 * //   { type: "cond", cond: { field: "status", op: "eq", value: "open" } },
 * //   { type: "or", nodes: [
 * //     { type: "cond", cond: { field: "amount", op: "lt", value: 0 } },
 * //     { type: "cond", cond: { field: "amount", op: "gt", value: 10 } },
 * //   ] },
 * // ] }
 * ```
 */
export function compileFilterNode(input: {
  spec: FieldKindSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): { where: CompiledWhere | null } {
  return { where: nodeToWhere(input.spec, input.node, input.resolveDate) };
}
