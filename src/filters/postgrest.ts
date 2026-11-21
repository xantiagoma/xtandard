import { createKeysetSpec, type KeysetSortColumn, type KeysetWhere } from "../keyset.ts";
import type { CursorDirection } from "../pagination.ts";
import { compileFilterNode, compileFilters, type DateFilterResolver } from "./compile.ts";
import type {
  ColumnFilter,
  CompiledCond,
  CompiledWhere,
  FieldKind,
  FilterNode,
  ScalarValue,
  Sort,
} from "./types.ts";

/** One allow-listed field: its filter kind plus the PostgREST column it reads (`"name"`, or a
 * JSON path such as `"meta->>city"`). */
export type PostgrestFieldSpec = { kind: FieldKind; column: string };
/** A resource's filter allow-list: public field name → {@link PostgrestFieldSpec}. */
export type PostgrestFilterSpec = Record<string, PostgrestFieldSpec>;
/**
 * PostgREST query parameters as unencoded `[key, value]` pairs, in order (keys may repeat;
 * PostgREST ANDs them). Pass to `new URLSearchParams(params)` for a plain `fetch`, or to
 * `applyParamsToPostgrest` for a postgrest-js / supabase-js builder.
 */
export type PostgrestParams = [key: string, value: string][];

const field =
  (kind: FieldKind) =>
  (input: { column: string }): PostgrestFieldSpec => ({ kind, column: input.column });

/**
 * Allow-list a public field as a `date` filter over a PostgREST column (`timestamptz`/`date`).
 * A `date` preset needs the `resolveDate` you pass to `buildParams`, and becomes a half-open
 * `gte`/`lt` window with ISO-8601 instants.
 *
 * @example
 * ```ts
 * import { buildParams, dateField } from "@xtandard/lib/filters/postgrest";
 *
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") });
 * const { params } = buildParams({
 *   spec: { createdAt: dateField({ column: "created_at" }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * });
 * // params → [["created_at", "gte.2026-01-01T00:00:00.000Z"], ["created_at", "lt.2026-02-01T00:00:00.000Z"]]
 * ```
 */
export const dateField = field("date");
/**
 * Allow-list a public field as a `text` filter over a PostgREST column. `contains`/
 * `startsWith`/`endsWith` become `ilike` with `*` wildcards (the user's `%`, `_` and `\` are
 * escaped); `like`/`ilike` patterns are passed through with `%` spelled `*`. A literal `*`
 * can't be written in a PostgREST LIKE pattern, so those fall back to `match`/`imatch`
 * (POSIX regex).
 *
 * @example
 * ```ts
 * import { buildParams, textField } from "@xtandard/lib/filters/postgrest";
 *
 * const spec = { name: textField({ column: "name" }) };
 * buildParams({ spec, filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "50%" } }] }).params;
 * // → [["name", "ilike.*50\\%*"]]  (prints as ilike.*50\%*)
 * buildParams({ spec, filters: [{ field: "name", filter: { kind: "text", operator: "startsWith", value: "a*b" } }] }).params;
 * // → [["name", "imatch.^a\\*b"]]  (prints as imatch.^a\*b)
 * ```
 */
export const textField = field("text");
/**
 * Allow-list a public field as a `number` filter over a PostgREST column. `between` becomes
 * `gte` + `lte` (two params on the same column, which PostgREST ANDs).
 *
 * @example
 * ```ts
 * import { buildParams, numberField } from "@xtandard/lib/filters/postgrest";
 *
 * const { params } = buildParams({
 *   spec: { total: numberField({ column: "total" }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } }],
 * });
 * // params → [["total", "gte.10"], ["total", "lte.20"]]
 * ```
 */
export const numberField = field("number");
/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null checks)
 * over a PostgREST column. List values containing PostgREST reserved characters are
 * double-quoted (and `"`/`\` backslash-escaped).
 *
 * @example
 * ```ts
 * import { buildParams, enumField } from "@xtandard/lib/filters/postgrest";
 *
 * const { params } = buildParams({
 *   spec: { status: enumField({ column: "status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "on hold, maybe"] } }],
 * });
 * // params → [["status", 'in.(open,"on hold, maybe")']]
 * ```
 */
export const enumField = field("enum");
/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a PostgREST
 * column.
 *
 * @example
 * ```ts
 * import { booleanField, buildParams } from "@xtandard/lib/filters/postgrest";
 *
 * const { params } = buildParams({
 *   spec: { done: booleanField({ column: "done" }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "eq", value: false } }],
 * });
 * // params → [["done", "eq.false"]]
 * ```
 */
export const booleanField = field("boolean");
/**
 * Allow-list a public field as an `array` filter over a Postgres array column (`text[]`,
 * `int[]`). `arrayContains` → `cs` (`@>`), `arrayContained` → `cd` (`<@`), `arrayOverlaps` →
 * `ov` (`&&`), each with a Postgres array literal whose string elements are always quoted.
 *
 * @example
 * ```ts
 * import { arrayField, buildParams } from "@xtandard/lib/filters/postgrest";
 *
 * const { params } = buildParams({
 *   spec: { tags: arrayField({ column: "tags" }) },
 *   filters: [{ field: "tags", filter: { kind: "array", operator: "arrayContains", values: ["ts", "a,b"] } }],
 * });
 * // params → [["tags", 'cs.{"ts","a,b"}']]
 * ```
 */
export const arrayField = field("array");

// ── rendering ──

// A column (optionally with `->`/`->>` JSON path steps) PostgREST parses unquoted.
const COLUMN = /^[A-Za-z_][A-Za-z0-9_$]*(?:->>?[A-Za-z0-9_$]+)*$/;

/** Validate a server-owned column (or JSON path) before it goes into a query string. */
function assertColumn(column: string): string {
  if (!COLUMN.test(column)) {
    throw new Error(
      `filters/postgrest: invalid column "${column}" (use an identifier, optionally with ->/->> JSON path steps)`,
    );
  }

  return column;
}

// Query-string keys PostgREST reserves: a filter on a column with one of these names can't be
// a top-level `col=op.val` param, so it is wrapped in `and=(…)`.
const RESERVED_KEYS = new Set([
  "select",
  "columns",
  "on_conflict",
  "order",
  "limit",
  "offset",
  "and",
  "or",
  "not",
]);

const formatScalar = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value);

// PostgREST's documented reserved characters (`, . : * ( )`), plus `"`/`\` (the quoting
// characters) and anything the parser would trim or read as empty. Quoting such a value inside
// `or=(…)`/`and=(…)`/`in.(…)` keeps it literal.
const NEEDS_QUOTES = /[,.:*()"\\]|^\s|\s$|^$|^\{/;
const quoted = (value: string): string => `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
const quoteIfNeeded = (value: string): string => (NEEDS_QUOTES.test(value) ? quoted(value) : value);

// A Postgres array literal: numbers bare, strings always double-quoted (so commas, braces,
// spaces, `NULL` and the empty string stay literal).
const pgArrayLiteral = (values: (string | number)[]): string =>
  `{${values.map((v) => (typeof v === "number" ? String(v) : quoted(v))).join(",")}}`;

const escapeLikeChars = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`);
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// SQL LIKE pattern → the PostgREST spelling: unescaped `%` → `*` (so URLs stay readable),
// everything else verbatim (`_`, `\%`, `\_`, `\\` keep their LIKE meaning).
function likeToPostgrest(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i] ?? "";
    if (c === "\\" && i + 1 < pattern.length) {
      out += c + (pattern[i + 1] ?? "");
      i += 1;
    } else {
      out += c === "%" ? "*" : c;
    }
  }

  return out;
}

// SQL LIKE pattern → an anchored POSIX regex (for `match`/`imatch`, used when the pattern holds
// a literal `*` that PostgREST would otherwise turn into `%`).
function likeToRegex(pattern: string): string {
  let out = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i] ?? "";
    if (c === "\\" && i + 1 < pattern.length) {
      out += escapeRegex(pattern[i + 1] ?? "");
      i += 1;
    } else if (c === "%") {
      out += ".*";
    } else if (c === "_") {
      out += ".";
    } else {
      out += escapeRegex(c);
    }
  }

  return `${out}$`;
}

/** One rendered condition: `[not.]op.value` against a column. `value` is already in its final
 * top-level spelling; `logicValue` is the spelling inside `or=(…)`/`and=(…)`. */
type Leaf = { negated: boolean; op: string; value: string; logicValue: string };

const scalarLeaf = (op: string, value: unknown, negated = false): Leaf => {
  const raw = formatScalar(value);

  return { negated, op, value: raw, logicValue: quoteIfNeeded(raw) };
};

function textLeaf(cond: CompiledCond & { value: string }): Leaf {
  const v = cond.value;
  switch (cond.op) {
    case "contains":
    case "startsWith":
    case "endsWith": {
      if (v.includes("*")) {
        const re = escapeRegex(v);
        const regex = cond.op === "contains" ? re : cond.op === "startsWith" ? `^${re}` : `${re}$`;

        return scalarLeaf("imatch", regex);
      }
      const esc = escapeLikeChars(v);
      const pattern =
        cond.op === "contains" ? `*${esc}*` : cond.op === "startsWith" ? `${esc}*` : `*${esc}`;

      return scalarLeaf("ilike", pattern);
    }
    default: {
      const regex = v.includes("*");
      const pattern = regex ? likeToRegex(v) : likeToPostgrest(v);
      const op = cond.op === "like" ? (regex ? "match" : "like") : regex ? "imatch" : "ilike";

      return scalarLeaf(op, pattern, cond.op === "notIlike");
    }
  }
}

function leafOf(cond: CompiledCond): Leaf {
  switch (cond.op) {
    case "eq":
      return scalarLeaf("eq", cond.value);
    case "ne":
      return scalarLeaf("neq", cond.value);
    case "lt":
    case "gt":
    case "lte":
    case "gte":
      return scalarLeaf(cond.op, cond.value);
    case "contains":
    case "startsWith":
    case "endsWith":
    case "like":
    case "ilike":
    case "notIlike":
      return textLeaf(cond);
    case "inArray":
    case "notInArray": {
      // PostgREST reads `in.("")` as an empty list (matches nothing); spell `[""]` as `eq`/`neq`.
      if (cond.values.length === 1 && cond.values[0] === "") {
        return scalarLeaf(cond.op === "inArray" ? "eq" : "neq", "");
      }
      const list = `(${cond.values.map((v) => quoteIfNeeded(formatScalar(v))).join(",")})`;

      return { negated: cond.op === "notInArray", op: "in", value: list, logicValue: list };
    }
    case "arrayContains":
    case "arrayContained":
    case "arrayOverlaps": {
      const literal = pgArrayLiteral(cond.values);
      const op = cond.op === "arrayContains" ? "cs" : cond.op === "arrayContained" ? "cd" : "ov";
      // Inside a logic tree an unquoted `{…}` may not contain braces; quote it then.
      const inner = literal.slice(1, -1);
      const logicValue = /[{}]/.test(inner) ? quoted(literal) : literal;

      return { negated: false, op, value: literal, logicValue };
    }
    case "isNull":
      return { negated: false, op: "is", value: "null", logicValue: "null" };
    case "isNotNull":
      return { negated: true, op: "is", value: "null", logicValue: "null" };
  }
}

/** The pieces of a rendered tree, before choosing top-level params vs a logic string. */
type Rendered =
  | { type: "leaf"; column: string; leaf: Leaf }
  | { type: "group"; op: "and" | "or"; negated: boolean; nodes: Rendered[] };

function prepare(
  node: CompiledWhere,
  columns: Record<string, string>,
  negated: boolean,
): Rendered | undefined {
  switch (node.type) {
    case "cond": {
      const column = columns[node.cond.field];
      if (column === undefined) return undefined;
      const leaf = leafOf(node.cond);

      return {
        type: "leaf",
        column: assertColumn(column),
        leaf: negated ? { ...leaf, negated: !leaf.negated } : leaf,
      };
    }
    case "and":
    case "or": {
      const nodes = node.nodes
        .map((n) => prepare(n, columns, false))
        .filter((n): n is Rendered => n !== undefined);
      if (nodes.length === 0) return undefined;
      if (nodes.length === 1) {
        const only = nodes[0] as Rendered;

        return negated ? negate(only) : only;
      }

      return { type: "group", op: node.type, negated, nodes };
    }
    case "not":
      return prepare(node.node, columns, !negated);
  }
}

const negate = (r: Rendered): Rendered =>
  r.type === "leaf"
    ? { ...r, leaf: { ...r.leaf, negated: !r.leaf.negated } }
    : { ...r, negated: !r.negated };

const opPrefix = (leaf: Leaf): string => `${leaf.negated ? "not." : ""}${leaf.op}`;

/** A node in the `or=(…)` / `and=(…)` grammar: `col.op.val` or `[not.]and(…)`. */
function logicString(r: Rendered): string {
  if (r.type === "leaf") return `${r.column}.${opPrefix(r.leaf)}.${r.leaf.logicValue}`;

  return `${r.negated ? "not." : ""}${r.op}(${r.nodes.map(logicString).join(",")})`;
}

/** Top-level params: an un-negated AND splits into one param per child. */
function toParams(r: Rendered): PostgrestParams {
  if (r.type === "leaf") {
    if (RESERVED_KEYS.has(r.column)) return [["and", `(${logicString(r)})`]];

    return [[r.column, `${opPrefix(r.leaf)}.${r.leaf.value}`]];
  }
  if (r.op === "and" && !r.negated) return r.nodes.flatMap(toParams);

  return [[`${r.negated ? "not." : ""}${r.op}`, `(${r.nodes.map(logicString).join(",")})`]];
}

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to PostgREST query parameters, looking each
 * field up in `columns`. Conditions on fields missing from `columns` are dropped; `null` (or an
 * AST that drops to nothing) gives `[]`. A top-level `and` becomes one param per condition
 * (PostgREST ANDs them); `or` → `or=(…)`, a negated group → `not.or=(…)`/`not.and=(…)`, a
 * negated condition → the `not.` operator prefix. Most code calls `buildParams`, which compiles
 * and renders in one step.
 *
 * @example
 * ```ts
 * import { toPostgrestParams } from "@xtandard/lib/filters/postgrest";
 *
 * toPostgrestParams({
 *   where: { type: "or", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "not", node: { type: "cond", cond: { field: "name", op: "isNull" } } },
 *   ] },
 *   columns: { amount: "amount", name: "name" },
 * });
 * // → [["or", "(amount.gt.5,name.not.is.null)"]]
 * ```
 */
export function toPostgrestParams(input: {
  where: CompiledWhere | null;
  columns: Record<string, string>;
}): PostgrestParams {
  const rendered = input.where ? prepare(input.where, input.columns, false) : undefined;

  return rendered ? toParams(rendered) : [];
}

const columnsOf = (spec: PostgrestFilterSpec): Record<string, string> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.column]));
const kindsOf = (spec: PostgrestFilterSpec): Record<string, FieldKind> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.kind]));

/**
 * Compile a flat, AND-combined list of column filters into PostgREST query parameters. Only
 * fields in `spec` whose kind matches the filter's `kind` are kept; the rest are silently
 * dropped (`params` is `[]` when nothing survives). A `date` preset filter needs `resolveDate`
 * (it throws without one).
 *
 * @example
 * ```ts
 * import { buildParams, numberField, textField } from "@xtandard/lib/filters/postgrest";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const { params } = buildParams({ spec, filters: [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ] });
 * // params → [["name", "ilike.Re*"], ["amount", "gte.100"]]
 * new URLSearchParams(params).toString(); // → "name=ilike.Re*&amount=gte.100"
 * // in an app: await fetch(`${POSTGREST_URL}/tasks?${new URLSearchParams(params)}`)
 * ```
 */
export function buildParams(input: {
  spec: PostgrestFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): { params: PostgrestParams } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return { params: toPostgrestParams({ where, columns: columnsOf(input.spec) }) };
}

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into PostgREST query parameters.
 * Same allow-list rules as `buildParams`; values inside `or=(…)`/`and=(…)` are double-quoted
 * when they contain a reserved character.
 *
 * @example
 * ```ts
 * import { buildFilterNode, numberField, textField } from "@xtandard/lib/filters/postgrest";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const { params } = buildFilterNode({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent, May" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * // params → [["or", '(name.eq."Rent, May",amount.not.lt.0)']]
 * ```
 */
export function buildFilterNode(input: {
  spec: PostgrestFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): { params: PostgrestParams } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return { params: toPostgrestParams({ where, columns: columnsOf(input.spec) }) };
}

/** Minimal structural postgrest-js / supabase-js filter builder (no `@supabase/*` import). */
export type PostgrestFilterBuilder = {
  filter(column: string, operator: string, value: unknown): unknown;
  or(filters: string): unknown;
};

/**
 * Add {@link PostgrestParams} (from `buildParams`, `buildFilterNode` or a keyset's `where`) to a
 * postgrest-js / supabase-js query with its public methods: a column param becomes
 * `.filter(column, operator, value)`, `or=(…)` becomes `.or(…)`, and an `and=(…)`/`not.or=(…)`
 * param is wrapped as a one-element `.or("and(…)")`. Returns the same `builder` for chaining.
 * Works with any object that has `filter` and `or`, so this module never imports
 * `@supabase/postgrest-js`.
 *
 * @example
 * ```ts
 * import { applyParamsToPostgrest } from "@xtandard/lib/filters/postgrest";
 *
 * // in an app: applyParamsToPostgrest(supabase.from("tasks").select(), params)
 * const calls: unknown[] = [];
 * const builder = {
 *   filter: (...args: unknown[]) => calls.push(["filter", ...args]),
 *   or: (filters: string) => calls.push(["or", filters]),
 * };
 * applyParamsToPostgrest(builder, [["amount", "not.in.(1,2)"], ["not.or", "(a.eq.1,b.eq.2)"]]) === builder; // → true
 * calls; // → [["filter", "amount", "not.in", "(1,2)"], ["or", "not.or(a.eq.1,b.eq.2)"]]
 * ```
 */
export function applyParamsToPostgrest<B extends PostgrestFilterBuilder>(
  builder: B,
  params: PostgrestParams,
): B {
  for (const [key, value] of params) {
    if (key === "or") {
      builder.or(value.slice(1, -1));
    } else if (key === "and" || key === "not.and" || key === "not.or") {
      builder.or(`${key}${value}`);
    } else {
      // `[not.]op.rest` → operator `[not.]op`, value `rest`.
      const negated = value.startsWith("not.");
      const body = negated ? value.slice(4) : value;
      const dot = body.indexOf(".");
      builder.filter(key, `${negated ? "not." : ""}${body.slice(0, dot)}`, body.slice(dot + 1));
    }
  }

  return builder;
}

/**
 * Compile `filters` with {@link buildParams} and add them to a postgrest-js / supabase-js
 * query via {@link applyParamsToPostgrest}. When no filter survives the allow-list, nothing is
 * called. Returns the same `builder` for chaining.
 *
 * @example
 * ```ts
 * import type { ColumnFilter } from "@xtandard/lib/filters";
 * import { applyFiltersToPostgrest, numberField } from "@xtandard/lib/filters/postgrest";
 *
 * const spec = { amount: numberField({ column: "amount" }) };
 * const filters: ColumnFilter[] = [{ field: "amount", filter: { kind: "number", operator: "gte", value: 100 } }];
 * // in an app: const { data } = await applyFiltersToPostgrest(supabase.from("tasks").select(), { spec, filters });
 * const calls: unknown[] = [];
 * const builder = { filter: (...args: unknown[]) => calls.push(args), or: () => {} };
 * applyFiltersToPostgrest(builder, { spec, filters });
 * calls; // → [["amount", "gte", "100"]]
 * ```
 */
export function applyFiltersToPostgrest<B extends PostgrestFilterBuilder>(
  builder: B,
  input: { spec: PostgrestFilterSpec; filters: ColumnFilter[]; resolveDate?: DateFilterResolver },
): B {
  return applyParamsToPostgrest(builder, buildParams(input).params);
}

// ── sort + keyset ──

/**
 * One `order` term. Its fields line up with postgrest-js:
 * `query.order(term.column, { ascending: term.ascending, nullsFirst: term.nullsFirst })`.
 * `nullsFirst` is omitted when the Postgres default applies (NULLs last ascending, first
 * descending).
 */
export type PostgrestOrderTerm = { column: string; ascending: boolean; nullsFirst?: boolean };

/**
 * Serialize order terms to the value of PostgREST's `order` query parameter
 * (`column.asc|desc[.nullsfirst|.nullslast]`, comma-separated), or `undefined` when empty.
 *
 * @example
 * ```ts
 * import { formatOrder } from "@xtandard/lib/filters/postgrest";
 *
 * formatOrder([{ column: "created_at", ascending: false, nullsFirst: false }, { column: "id", ascending: true }]);
 * // → "created_at.desc.nullslast,id.asc"
 * formatOrder([]); // → undefined
 * ```
 */
export function formatOrder(order: PostgrestOrderTerm[]): string | undefined {
  if (order.length === 0) return undefined;

  return order
    .map((t) => {
      const nulls = t.nullsFirst === undefined ? "" : t.nullsFirst ? ".nullsfirst" : ".nullslast";

      return `${assertColumn(t.column)}.${t.ascending ? "asc" : "desc"}${nulls}`;
    })
    .join(",");
}

/**
 * Render a `Sort` to PostgREST order terms, allow-listed to `columns` (public field name →
 * column). Unknown fields are dropped; when nothing is left, `defaultSort` is used instead.
 * `nulls` pins where NULLs go for every term (default: Postgres's — last ascending, first
 * descending). Apply with `query.order(t.column, t)` per term (postgrest-js / supabase-js) or
 * as `order=${formatOrder(order)}`.
 *
 * @example
 * ```ts
 * import { buildOrder, formatOrder } from "@xtandard/lib/filters/postgrest";
 *
 * const { order } = buildOrder({
 *   sort: [{ field: "createdAt", dir: "desc" }, { field: "password", dir: "asc" }], // password: not sortable
 *   columns: { createdAt: "created_at", name: "name" },
 *   nulls: "last",
 * });
 * // order → [{ column: "created_at", ascending: false, nullsFirst: false }]
 * formatOrder(order); // → "created_at.desc.nullslast"
 * // in an app: for (const t of order) query = query.order(t.column, t);
 * ```
 */
export function buildOrder(input: {
  sort: Sort;
  columns: Record<string, string>;
  defaultSort?: Sort;
  nulls?: "first" | "last";
}): { order: PostgrestOrderTerm[] } {
  const resolve = (sort: Sort): PostgrestOrderTerm[] =>
    sort.flatMap((item) => {
      const column = input.columns[item.field];
      if (column === undefined) return [];
      const term: PostgrestOrderTerm = {
        column: assertColumn(column),
        ascending: item.dir === "asc",
      };
      if (input.nulls) term.nullsFirst = input.nulls === "first";

      return [term];
    });

  const ordered = resolve(input.sort);

  return { order: ordered.length > 0 ? ordered : resolve(input.defaultSort ?? []) };
}

/** The keyset helper returned by {@link createPostgrestKeyset}. */
export interface PostgrestKeyset {
  /** Logical cursor keys, in sort order — use to build `cursor.fromItem`. */
  keys: () => string[];
  /** Order terms for a fetch direction (backward flips, the paginator restores). */
  orderBy: (direction?: CursorDirection) => PostgrestOrderTerm[];
  /** Lexicographic seek params for a decoded cursor (`[]` for a `null` cursor: first page). */
  where: (
    cursor: Record<string, unknown> | null | undefined,
    direction?: CursorDirection,
  ) => PostgrestParams;
}

const seekToWhere = (
  seek: KeysetWhere | null,
  columns: Record<string, string>,
): CompiledWhere | null => {
  if (!seek) return null;
  const nodes = seek.or.flatMap((clause): CompiledWhere[] => {
    const conds = clause.and.flatMap((p): CompiledWhere[] =>
      columns[p.key] === undefined
        ? []
        : [{ type: "cond", cond: { field: p.key, op: p.op, value: p.value as ScalarValue } }],
    );

    return conds.length === 0
      ? []
      : [conds.length === 1 ? (conds[0] as CompiledWhere) : { type: "and", nodes: conds }];
  });
  if (nodes.length === 0) return null;

  return nodes.length === 1 ? (nodes[0] as CompiledWhere) : { type: "or", nodes };
};

/**
 * Build a keyset (cursor) helper from a sort spec + the PostgREST column each logical key maps
 * to. The last sort column MUST be unique (a tiebreaker like `id`) so the cursor is stable.
 * `orderBy(direction)` gives the order terms (`"backward"` flips every column) and
 * `where(cursor, direction)` the lexicographic seek as PostgREST params (`[]` for the first
 * page). Sort keys without a column in `columns` are skipped. Combine with `buildParams` output
 * (PostgREST ANDs every param) and `limit=pageSize + 1`.
 *
 * @example
 * ```ts
 * import { createPostgrestKeyset, formatOrder } from "@xtandard/lib/filters/postgrest";
 *
 * const keyset = createPostgrestKeyset({
 *   sort: [{ key: "createdAt", order: "desc" }, { key: "id", order: "desc" }], // unique tiebreaker last
 *   columns: { createdAt: "created_at", id: "id" },
 * });
 * formatOrder(keyset.orderBy()); // → "created_at.desc,id.desc"
 * keyset.where(null); // → [] (first page)
 * keyset.where({ createdAt: new Date("2026-06-18T00:00:00Z"), id: 9 });
 * // → [["or", '(created_at.lt."2026-06-18T00:00:00.000Z",and(created_at.eq."2026-06-18T00:00:00.000Z",id.lt.9))']]
 * ```
 */
export function createPostgrestKeyset(input: {
  sort: KeysetSortColumn[];
  columns: Record<string, string>;
}): PostgrestKeyset {
  const spec = createKeysetSpec({ sort: input.sort });
  const { columns } = input;

  return {
    keys: () => spec.keys(),
    orderBy: (direction) =>
      spec.orderBy(direction).flatMap((key) => {
        const column = columns[key.key];

        return column === undefined
          ? []
          : [{ column: assertColumn(column), ascending: key.order === "asc" }];
      }),
    where: (cursor, direction) =>
      toPostgrestParams({ where: seekToWhere(spec.where(cursor, direction), columns), columns }),
  };
}
