import { createKeysetSpec, type KeysetSortColumn } from "../keyset.ts";
import type { CursorDirection } from "../pagination.ts";
import { compileFilterNode, compileFilters, type DateFilterResolver } from "./compile.ts";
import type {
  ColumnFilter,
  CompiledCond,
  CompiledWhere,
  FieldKind,
  FilterNode,
  Sort,
} from "./types.ts";

/** One allow-listed field: its filter kind plus the indexed field it queries — a `keyword`,
 * numeric, `date` or `boolean` field (for text, the `keyword` sub-field, e.g. `"name.keyword"`). */
export type ElasticsearchFieldSpec = { kind: FieldKind; field: string };
/** A resource's filter allow-list: public field name → {@link ElasticsearchFieldSpec}. */
export type ElasticsearchFilterSpec = Record<string, ElasticsearchFieldSpec>;
/** One Query DSL clause (`{ term: … }`, `{ bool: … }`, …), ready for the `query` of a search
 * request (Elasticsearch or OpenSearch client, or a raw `_search` body). */
export type ElasticsearchQuery = Record<string, unknown>;
/** One `sort` entry: `{ [field]: { order, missing? } }`. */
export type ElasticsearchSort = Record<
  string,
  { order: "asc" | "desc"; missing?: "_first" | "_last" }
>;

const make =
  (kind: FieldKind) =>
  (input: { field: string }): ElasticsearchFieldSpec => ({ kind, field: input.field });

/**
 * Allow-list a public field as a `date` filter over a `date` field. A `date` preset needs the
 * `resolveDate` you pass to `buildQuery`, and becomes a half-open `range` (`gte`/`lt`) with
 * ISO-8601 instants.
 *
 * @example
 * ```ts
 * import { buildQuery, dateField } from "@xtandard/lib/filters/elasticsearch";
 *
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") });
 * const { query } = buildQuery({
 *   spec: { createdAt: dateField({ field: "createdAt" }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * });
 * // query → { bool: { filter: [
 * //   { range: { createdAt: { gte: "2026-01-01T00:00:00.000Z" } } },
 * //   { range: { createdAt: { lt: "2026-02-01T00:00:00.000Z" } } },
 * // ] } }
 * ```
 */
export const dateField = make("date");
/**
 * Allow-list a public field as a `text` filter. Point it at a `keyword` field (or a text
 * field's `.keyword` sub-field): `eq` is an exact `term`, `contains`/`endsWith` a
 * case-insensitive `wildcard` (input escaped), `startsWith` a case-insensitive `prefix`, and
 * `like`/`ilike` patterns are translated to `wildcard` (`%` → `*`, `_` → `?`).
 *
 * @example
 * ```ts
 * import { buildQuery, textField } from "@xtandard/lib/filters/elasticsearch";
 *
 * const { query } = buildQuery({
 *   spec: { name: textField({ field: "name.keyword" }) },
 *   filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "a*b" } }],
 * });
 * // query → { wildcard: { "name.keyword": { value: "*a\\*b*", case_insensitive: true } } }
 * ```
 */
export const textField = make("text");
/**
 * Allow-list a public field as a `number` filter over a numeric field. `between` becomes two
 * `range` clauses (`gte` + `lte`).
 *
 * @example
 * ```ts
 * import { buildQuery, numberField } from "@xtandard/lib/filters/elasticsearch";
 *
 * const { query } = buildQuery({
 *   spec: { total: numberField({ field: "total" }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "gt", value: 10 } }],
 * });
 * // query → { range: { total: { gt: 10 } } }
 * ```
 */
export const numberField = make("number");
/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null checks)
 * over a `keyword` field. `inArray` → `terms`.
 *
 * @example
 * ```ts
 * import { buildQuery, enumField } from "@xtandard/lib/filters/elasticsearch";
 *
 * const { query } = buildQuery({
 *   spec: { status: enumField({ field: "status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "done"] } }],
 * });
 * // query → { terms: { status: ["open", "done"] } }
 * ```
 */
export const enumField = make("enum");
/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a `boolean`
 * field. `ne` keeps SQL semantics: documents without the field don't match.
 *
 * @example
 * ```ts
 * import { booleanField, buildQuery } from "@xtandard/lib/filters/elasticsearch";
 *
 * const { query } = buildQuery({
 *   spec: { done: booleanField({ field: "done" }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "ne", value: true } }],
 * });
 * // query → { bool: { filter: [{ exists: { field: "done" } }], must_not: [{ term: { done: true } }] } }
 * ```
 */
export const booleanField = make("boolean");
/**
 * Allow-list a public field as an `array` filter over a multi-valued `keyword` (or numeric)
 * field. `arrayContains` → one `term` per value (all must match), `arrayOverlaps` → `terms`.
 * `arrayContained` (field ⊆ values) has no script-free Query DSL equivalent and throws.
 *
 * @example
 * ```ts
 * import { arrayField, buildQuery } from "@xtandard/lib/filters/elasticsearch";
 *
 * const spec = { tags: arrayField({ field: "tags" }) };
 * buildQuery({ spec, filters: [{ field: "tags", filter: { kind: "array", operator: "arrayContains", values: ["ts", "js"] } }] }).query;
 * // → { bool: { filter: [{ term: { tags: "ts" } }, { term: { tags: "js" } }] } }
 * buildQuery({ spec, filters: [{ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] } }] }).query;
 * // → { terms: { tags: ["ts", "js"] } }
 * ```
 */
export const arrayField = make("array");

// ── rendering ──

const value = (v: unknown): unknown => (v instanceof Date ? v.toISOString() : v);

const escapeWildcard = (s: string): string => s.replace(/[\\*?]/g, (c) => `\\${c}`);

// SQL LIKE pattern → a Lucene wildcard pattern: `%` → `*`, `_` → `?`, `\x` → literal x;
// literal `*`/`?`/`\` are escaped with `\` (Lucene's wildcard escape).
function likeToWildcard(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i] ?? "";
    if (c === "\\" && i + 1 < pattern.length) {
      out += escapeWildcard(pattern[i + 1] ?? "");
      i += 1;
    } else if (c === "%") {
      out += "*";
    } else if (c === "_") {
      out += "?";
    } else {
      out += escapeWildcard(c);
    }
  }

  return out;
}

const MATCH_NONE: ElasticsearchQuery = { match_none: {} };
const exists = (field: string): ElasticsearchQuery => ({ exists: { field } });
const allOf = (clauses: ElasticsearchQuery[]): ElasticsearchQuery =>
  clauses.length === 1 ? (clauses[0] as ElasticsearchQuery) : { bool: { filter: clauses } };
const anyOf = (clauses: ElasticsearchQuery[]): ElasticsearchQuery =>
  clauses.length === 1
    ? (clauses[0] as ElasticsearchQuery)
    : { bool: { should: clauses, minimum_should_match: 1 } };
/** SQL `NOT p` for a field-bound `p`: true only when the field has a value and `p` is false. */
const presentAndNot = (field: string, p: ElasticsearchQuery): ElasticsearchQuery => ({
  bool: { filter: [exists(field)], must_not: [p] },
});

const wildcard = (
  field: string,
  pattern: string,
  caseInsensitive: boolean,
): ElasticsearchQuery => ({
  wildcard: {
    [field]: caseInsensitive ? { value: pattern, case_insensitive: true } : { value: pattern },
  },
});

/**
 * A condition as a (positive query, negated?) pair: the condition is TRUE where `positive`
 * matches (or, when `negated`, where the field is present and `positive` doesn't). Its SQL
 * complement (FALSE, not NULL) is the opposite. `isNull`/`isNotNull` are never NULL themselves.
 */
type Leaf = { positive: ElasticsearchQuery; negated: boolean; total: boolean };

function leafOf(cond: CompiledCond, field: string): Leaf {
  const pos = (positive: ElasticsearchQuery, negated = false): Leaf => ({
    positive,
    negated,
    total: false,
  });

  switch (cond.op) {
    case "eq":
    case "ne":
      return pos({ term: { [field]: value(cond.value) } }, cond.op === "ne");
    case "lt":
    case "gt":
    case "lte":
    case "gte":
      return pos({ range: { [field]: { [cond.op]: value(cond.value) } } });
    case "contains":
      return pos(wildcard(field, `*${escapeWildcard(cond.value)}*`, true));
    case "endsWith":
      return pos(wildcard(field, `*${escapeWildcard(cond.value)}`, true));
    case "startsWith":
      return pos({ prefix: { [field]: { value: cond.value, case_insensitive: true } } });
    case "like":
      return pos(wildcard(field, likeToWildcard(cond.value), false));
    case "ilike":
    case "notIlike":
      return pos(wildcard(field, likeToWildcard(cond.value), true), cond.op === "notIlike");
    case "inArray":
    case "notInArray":
      return pos(
        cond.values.length === 0 ? MATCH_NONE : { terms: { [field]: cond.values.map(value) } },
        cond.op === "notInArray",
      );
    case "arrayContains":
      // Every value present; `[]` ⊆ anything, so an empty list only requires a value.
      return pos(
        cond.values.length === 0
          ? exists(field)
          : allOf(cond.values.map((v) => ({ term: { [field]: v } }))),
      );
    case "arrayOverlaps":
      return pos(cond.values.length === 0 ? MATCH_NONE : { terms: { [field]: cond.values } });
    case "arrayContained":
      throw new Error(
        `filters/elasticsearch: "arrayContained" (field ⊆ values) has no script-free Query DSL equivalent; use a terms_set query with minimum_should_match_script (see docs/FILTERS.md).`,
      );
    case "isNull":
      return { positive: exists(field), negated: true, total: true };
    case "isNotNull":
      return { positive: exists(field), negated: false, total: true };
  }
}

/**
 * Render a leaf as SQL TRUE (`want === true`) or SQL FALSE (`want === false`). NULL (a missing
 * field) is neither, so `NOT (a < 5)` doesn't match documents without `a` — same as SQL.
 */
function leafQuery(leaf: Leaf, field: string, want: boolean): ElasticsearchQuery {
  const holds = want !== leaf.negated; // does the query want `positive` to match?
  if (holds) return leaf.positive;
  if (leaf.total) return { bool: { must_not: [leaf.positive] } };

  return presentAndNot(field, leaf.positive);
}

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to a Query DSL clause, looking each field up
 * in `fields`. Conditions on fields missing from `fields` are dropped; `null` (or an AST that
 * drops to nothing) gives `undefined`. `and` → `bool.filter`, `or` → `bool.should`
 * (`minimum_should_match: 1`), and negation follows SQL's three-valued logic: `ne`,
 * `notInArray`, `notIlike` and `not` never match a document where the field is missing or
 * `null` (an `exists` guard is added). Most code calls `buildQuery`, which compiles and renders
 * in one step.
 *
 * @example
 * ```ts
 * import { toElasticsearchQuery } from "@xtandard/lib/filters/elasticsearch";
 *
 * toElasticsearchQuery({
 *   where: { type: "or", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "not", node: { type: "cond", cond: { field: "name", op: "eq", value: "x" } } },
 *   ] },
 *   fields: { amount: "amount", name: "name" },
 * });
 * // → { bool: { should: [
 * //   { range: { amount: { gt: 5 } } },
 * //   { bool: { filter: [{ exists: { field: "name" } }], must_not: [{ term: { name: "x" } }] } },
 * // ], minimum_should_match: 1 } }
 * ```
 */
export function toElasticsearchQuery(input: {
  where: CompiledWhere | null;
  fields: Record<string, string>;
}): ElasticsearchQuery | undefined {
  // `want`: render where the node is SQL TRUE (true) or SQL FALSE (false).
  const render = (node: CompiledWhere, want: boolean): ElasticsearchQuery | undefined => {
    switch (node.type) {
      case "cond": {
        const field = input.fields[node.cond.field];

        return field === undefined ? undefined : leafQuery(leafOf(node.cond, field), field, want);
      }
      case "and":
      case "or": {
        const parts = node.nodes
          .map((n) => render(n, want))
          .filter((p): p is ElasticsearchQuery => p !== undefined);
        if (parts.length === 0) return undefined;

        // TRUE(and) = all TRUE; FALSE(and) = any FALSE (and dually for `or`).
        return (node.type === "and") === want ? allOf(parts) : anyOf(parts);
      }
      case "not":
        return render(node.node, !want);
    }
  };

  return input.where ? render(input.where, true) : undefined;
}

const fieldsOf = (spec: ElasticsearchFilterSpec): Record<string, string> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.field]));
const kindsOf = (spec: ElasticsearchFilterSpec): Record<string, FieldKind> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.kind]));

/**
 * Compile a flat, AND-combined list of column filters into a Query DSL clause. Only fields in
 * `spec` whose kind matches the filter's `kind` are kept; the rest are silently dropped.
 * `query` is `undefined` when nothing survives. A `date` preset filter needs `resolveDate` (it
 * throws without one). Put it in a `bool.filter` next to your own clauses (tenant, full-text
 * `match`) so it doesn't affect scoring.
 *
 * @example
 * ```ts
 * import { buildQuery, numberField, textField } from "@xtandard/lib/filters/elasticsearch";
 *
 * const spec = { name: textField({ field: "name.keyword" }), amount: numberField({ field: "amount" }) };
 * const { query } = buildQuery({ spec, filters: [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ] });
 * // query → { bool: { filter: [
 * //   { prefix: { "name.keyword": { value: "Re", case_insensitive: true } } },
 * //   { range: { amount: { gte: 100 } } },
 * // ] } }
 * // in an app: await client.search({ index: "tasks", query: { bool: { filter: query ? [query] : [] } } })
 * ```
 */
export function buildQuery(input: {
  spec: ElasticsearchFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): { query: ElasticsearchQuery | undefined } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return { query: toElasticsearchQuery({ where, fields: fieldsOf(input.spec) }) };
}

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into a Query DSL clause (or
 * `undefined`). Same allow-list rules as `buildQuery`; `not` follows SQL NULL semantics (see
 * {@link toElasticsearchQuery}).
 *
 * @example
 * ```ts
 * import { buildFilterNode, numberField, textField } from "@xtandard/lib/filters/elasticsearch";
 *
 * const spec = { name: textField({ field: "name" }), amount: numberField({ field: "amount" }) };
 * const { query } = buildFilterNode({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * // query → { bool: { should: [
 * //   { term: { name: "Rent" } },
 * //   { bool: { filter: [{ exists: { field: "amount" } }], must_not: [{ range: { amount: { lt: 0 } } }] } },
 * // ], minimum_should_match: 1 } }
 * ```
 */
export function buildFilterNode(input: {
  spec: ElasticsearchFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): { query: ElasticsearchQuery | undefined } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return { query: toElasticsearchQuery({ where, fields: fieldsOf(input.spec) }) };
}

// ── sort + keyset ──

const sortEntry = (
  field: string,
  order: "asc" | "desc",
  nulls: "first" | "last" | undefined,
): ElasticsearchSort => ({
  [field]: nulls ? { order, missing: nulls === "first" ? "_first" : "_last" } : { order },
});

/**
 * Render a `Sort` to an Elasticsearch/OpenSearch `sort` array, allow-listed to `fields` (public
 * field name → sortable field: `keyword`, numeric, `date`). Unknown fields are dropped; when
 * nothing is left, `defaultSort` is used instead. `nulls` sets `missing` on every entry
 * (Elasticsearch's default is `_last` in both directions, unlike Postgres).
 *
 * @example
 * ```ts
 * import { buildSort } from "@xtandard/lib/filters/elasticsearch";
 *
 * const { sort } = buildSort({
 *   sort: [{ field: "createdAt", dir: "desc" }, { field: "password", dir: "asc" }], // password: not sortable
 *   fields: { createdAt: "createdAt", name: "name.keyword" },
 *   defaultSort: [{ field: "name", dir: "asc" }],
 * });
 * // sort → [{ createdAt: { order: "desc" } }]
 * ```
 */
export function buildSort(input: {
  sort: Sort;
  fields: Record<string, string>;
  defaultSort?: Sort;
  nulls?: "first" | "last";
}): { sort: ElasticsearchSort[] } {
  const resolve = (sort: Sort): ElasticsearchSort[] =>
    sort.flatMap((item) => {
      const field = input.fields[item.field];

      return field === undefined ? [] : [sortEntry(field, item.dir, input.nulls)];
    });

  const ordered = resolve(input.sort);

  return { sort: ordered.length > 0 ? ordered : resolve(input.defaultSort ?? []) };
}

/** The keyset helper returned by {@link createElasticsearchKeyset}. */
export interface ElasticsearchKeyset {
  /** Logical cursor keys, in sort order — use to build `cursor.fromItem`. */
  keys: () => string[];
  /** The `sort` array for a fetch direction (backward flips, the paginator restores). */
  sort: (direction?: CursorDirection) => ElasticsearchSort[];
  /** The `search_after` values for a decoded cursor, in sort order (`undefined` for a `null`
   * cursor: first page). `Date`s become epoch milliseconds, like a `date` field's `hit.sort`. */
  searchAfter: (cursor: Record<string, unknown> | null | undefined) => unknown[] | undefined;
}

/**
 * Build a `search_after` keyset helper from a sort spec + the field each logical key sorts
 * on. The last sort column MUST be unique (a tiebreaker such as a `keyword` copy of the id) so
 * the cursor is stable. `sort(direction)` gives the `sort` array (`"backward"` flips every
 * column) and `searchAfter(cursor)` the matching `search_after` values. The seek happens in the
 * engine, so it composes with any `query` (including `buildQuery`'s). Sort keys without a field
 * in `fields` are skipped (keep `fields` complete: `search_after` must line up with `sort`).
 *
 * @example
 * ```ts
 * import { createElasticsearchKeyset } from "@xtandard/lib/filters/elasticsearch";
 *
 * const keyset = createElasticsearchKeyset({
 *   sort: [{ key: "createdAt", order: "desc" }, { key: "id", order: "desc" }], // unique tiebreaker last
 *   fields: { createdAt: "createdAt", id: "id" },
 * });
 * keyset.sort(); // → [{ createdAt: { order: "desc" } }, { id: { order: "desc" } }]
 * keyset.sort("backward"); // → [{ createdAt: { order: "asc" } }, { id: { order: "asc" } }]
 * keyset.searchAfter(null); // → undefined (first page)
 * keyset.searchAfter({ createdAt: new Date("2026-06-18T00:00:00Z"), id: "p_9" }); // → [1781740800000, "p_9"]
 * // in an app: client.search({ index, query, sort: keyset.sort(direction), search_after: keyset.searchAfter(cursor), size: limit + 1 })
 * ```
 */
export function createElasticsearchKeyset(input: {
  sort: KeysetSortColumn[];
  fields: Record<string, string>;
}): ElasticsearchKeyset {
  const spec = createKeysetSpec({ sort: input.sort });
  const mapped = () => spec.sort.filter((key) => input.fields[key.key] !== undefined);

  return {
    keys: () => spec.keys(),
    sort: (direction) =>
      spec.orderBy(direction).flatMap((key) => {
        const field = input.fields[key.key];

        return field === undefined ? [] : [sortEntry(field, key.order, undefined)];
      }),
    searchAfter: (cursor) =>
      cursor
        ? mapped().map((key) => {
            const v = cursor[key.key];

            return v instanceof Date ? v.getTime() : v;
          })
        : undefined,
  };
}
