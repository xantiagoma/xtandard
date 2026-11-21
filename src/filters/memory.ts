import type { CursorCodec } from "../cursor-codec.ts";
import type { CursorDirection, KeysetSortColumn, PaginatorSync } from "../entry-pagination.ts";

import { createKeysetSpec, createPaginator } from "../entry-pagination.ts";
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

/**
 * What a field reads from a row: a property key or dot path (`"name"`, `"address.city"`,
 * like the mongo adapter's `path`), or a getter function (like a raw expression in the
 * kysely adapter). Accessors are server-owned: never build one from request data.
 */
export type MemoryAccessor<Row = any> = string | ((row: Row) => unknown);
/** One allow-listed field: its filter kind plus the {@link MemoryAccessor} it reads. */
export type MemoryFieldSpec<Row = any> = { kind: FieldKind; path: MemoryAccessor<Row> };
/** A resource's filter allow-list: public field name → {@link MemoryFieldSpec}. */
export type MemoryFilterSpec<Row = any> = Record<string, MemoryFieldSpec<Row>>;
/** A row predicate, as returned by {@link toFilterPredicate} and {@link buildFilterPredicate}. */
export type FilterPredicate<Row = any> = (row: Row) => boolean;
/** A row comparator for `Array.prototype.sort`. */
export type RowComparator<Row = any> = (a: Row, b: Row) => number;

/**
 * The SQL engine whose semantics the in-memory evaluator copies (default `"postgres"`, like
 * the kysely/knex adapters' `dialect`). It decides three things:
 *
 * - **Case folding.** `postgres`: `like` is case-sensitive and `ilike` (with
 *   `contains`/`startsWith`/`endsWith`) folds Unicode (`Á` matches `á`). `sqlite`: `LIKE`
 *   folds ASCII letters only, for `like` and `ilike` alike (`A` matches `a`, `Á` doesn't
 *   match `á`).
 * - **NULL ordering.** `postgres`: NULL sorts as the largest value (last ascending, first
 *   descending). `sqlite`: NULL sorts as the smallest (first ascending, last descending).
 * - **Array ops on a NULL array.** `postgres`: UNKNOWN (no match, even under `not`).
 *   `sqlite`: the `json_each(…)` SQL the adapters render reads NULL as an empty list, so
 *   `arrayContained` matches it and `arrayContains`/`arrayOverlaps` don't.
 *
 * There is no `mysql`: its `=` and `LIKE` follow the column collation (usually case- and
 * accent-insensitive), which an evaluator can't know.
 */
export type MemoryDialect = "postgres" | "sqlite";

/** Where NULLs go in a sort, whatever the direction (SQL `NULLS FIRST` / `NULLS LAST`). */
export type NullsOrder = "first" | "last";

const field =
  (kind: FieldKind) =>
  <Row = any>(input: { path: MemoryAccessor<Row> }): MemoryFieldSpec<Row> => ({
    kind,
    path: input.path,
  });

/**
 * Allow-list a public field as a `date` filter over a row value read by `path` (a key, a dot
 * path, or a getter). The row value may be a `Date`, an ISO-8601 string, epoch milliseconds,
 * or any object with a numeric `epochMilliseconds` (`Temporal.Instant`,
 * `Temporal.ZonedDateTime`). A `date` preset needs the `resolveDate` you pass to
 * `buildFilterPredicate`, and becomes a half-open `[start, end)` window.
 *
 * @example
 * ```ts
 * import { buildFilterPredicate, dateField } from "@xtandard/lib/filters/memory";
 *
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") });
 * const { predicate } = buildFilterPredicate({
 *   spec: { createdAt: dateField({ path: "createdAt" }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * });
 * predicate({ createdAt: new Date("2026-01-31T23:59:59Z") }); // → true
 * predicate({ createdAt: "2026-02-01T00:00:00Z" }); // → false (the end is exclusive)
 * predicate({ createdAt: null }); // → false
 * ```
 */
export const dateField = field("date");
/**
 * Allow-list a public field as a `text` filter over a row value read by `path` (a key, a dot
 * path, or a getter). `contains`/`startsWith`/`endsWith` match the input literally and ignore
 * case; `like`/`ilike`/`notIlike` take a SQL pattern (`%`, `_`, `\` escapes). How case is
 * folded follows `dialect` (see {@link MemoryDialect}).
 *
 * @example
 * ```ts
 * import { buildFilterPredicate, textField } from "@xtandard/lib/filters/memory";
 *
 * const { predicate } = buildFilterPredicate({
 *   spec: { city: textField({ path: "address.city" }) },
 *   filters: [{ field: "city", filter: { kind: "text", operator: "contains", value: "LIM" } }],
 * });
 * predicate({ address: { city: "Lima" } }); // → true
 * predicate({ address: null }); // → false
 * ```
 */
export const textField = field("text");
/**
 * Allow-list a public field as a `number` filter over a row value read by `path` (a key, a dot
 * path, or a getter). `between` matches `>= from and <= to`; a `bigint` row value compares
 * numerically.
 *
 * @example
 * ```ts
 * import { buildFilterPredicate, numberField } from "@xtandard/lib/filters/memory";
 *
 * const { predicate } = buildFilterPredicate({
 *   spec: { total: numberField({ path: (order: { cents: number }) => order.cents / 100 }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } }],
 * });
 * predicate({ cents: 1999 }); // → true
 * predicate({ cents: 2001 }); // → false
 * ```
 */
export const numberField = field("number");
/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null checks)
 * over a row value read by `path`. As in SQL, `ne` and `notInArray` never match a NULL.
 *
 * @example
 * ```ts
 * import { buildFilterPredicate, enumField } from "@xtandard/lib/filters/memory";
 *
 * const { predicate } = buildFilterPredicate({
 *   spec: { status: enumField({ path: "status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "notInArray", values: ["done"] } }],
 * });
 * predicate({ status: "open" }); // → true
 * predicate({ status: null }); // → false (NULL NOT IN (…) is UNKNOWN)
 * ```
 */
export const enumField = field("enum");
/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a row value
 * read by `path`.
 *
 * @example
 * ```ts
 * import { booleanField, buildFilterPredicate } from "@xtandard/lib/filters/memory";
 *
 * const { predicate } = buildFilterPredicate({
 *   spec: { done: booleanField({ path: "done" }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "ne", value: true } }],
 * });
 * predicate({ done: false }); // → true
 * predicate({}); // → false (a missing value is NULL)
 * ```
 */
export const booleanField = field("boolean");
/**
 * Allow-list a public field as an `array` filter over a row value read by `path` that holds an
 * array. `arrayContains` is Postgres `@>` (the row has every value), `arrayContained` is `<@`
 * (every row element is a value) and `arrayOverlaps` is `&&` (at least one in common).
 *
 * @example
 * ```ts
 * import { arrayField, buildFilterPredicate } from "@xtandard/lib/filters/memory";
 *
 * const { predicate } = buildFilterPredicate({
 *   spec: { tags: arrayField({ path: "tags" }) },
 *   filters: [{ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] } }],
 * });
 * predicate({ tags: ["go", "ts"] }); // → true
 * predicate({ tags: [] }); // → false
 * ```
 */
export const arrayField = field("array");

// ── values ───────────────────────────────────────────────────────────────────

/** Three-valued logic: `null` is SQL's UNKNOWN. */
type Tri = boolean | null;
type Eval<Row> = (row: Row) => Tri;

const isNull = (value: unknown): value is null | undefined => value === null || value === undefined;

function pathGetter(path: string): (row: unknown) => unknown {
  const parts = path.split(".");

  return (row) => {
    let value: unknown = row;
    for (const part of parts) {
      if (isNull(value)) return undefined;
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  };
}

const getterOf = <Row>(accessor: MemoryAccessor<Row>): ((row: Row) => unknown) =>
  typeof accessor === "function" ? accessor : pathGetter(accessor);

const hasEpochMs = (value: unknown): value is { epochMilliseconds: number } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { epochMilliseconds?: unknown }).epochMilliseconds === "number";

const isInstant = (value: unknown): boolean => value instanceof Date || hasEpochMs(value);

function epochMs(value: unknown): number | undefined {
  let ms: number | undefined;
  if (value instanceof Date) ms = value.getTime();
  else if (hasEpochMs(value)) ms = value.epochMilliseconds;
  else if (typeof value === "number") ms = value;
  else if (typeof value === "string") ms = Date.parse(value);

  return ms === undefined || Number.isNaN(ms) ? undefined : ms;
}

const sign = (a: number | bigint, b: number | bigint): number | null =>
  a < b ? -1 : a > b ? 1 : a == b ? 0 : null; // NaN: incomparable

// Code point order (SQLite BINARY / Postgres "C" collation). JS `<` compares UTF-16 code
// units, which puts U+E000–U+FFFF after the astral planes; fix up the first difference.
function compareStrings(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    let x = a.charCodeAt(i);
    let y = b.charCodeAt(i);
    if (x === y) continue;
    if (x >= 0xd800 && y >= 0xd800) {
      x += x >= 0xe000 ? -0x800 : 0x2000;
      y += y >= 0xe000 ? -0x800 : 0x2000;
    }

    return x < y ? -1 : 1;
  }

  return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
}

/**
 * Compare two non-NULL values; `null` when they can't be compared (different types, an
 * unparsable date, NaN). An instant on either side compares both as epoch milliseconds.
 */
function compareScalars(a: unknown, b: unknown): number | null {
  if (isInstant(a) || isInstant(b)) {
    const x = epochMs(a);
    const y = epochMs(b);

    return x === undefined || y === undefined ? null : sign(x, y);
  }
  const ta = typeof a;
  const tb = typeof b;
  if ((ta === "number" || ta === "bigint") && (tb === "number" || tb === "bigint")) {
    return sign(a as number | bigint, b as number | bigint);
  }
  if (ta === "string" && tb === "string") return compareStrings(a as string, b as string);
  if (ta === "boolean" && tb === "boolean") return a === b ? 0 : a ? 1 : -1;

  return null;
}

// A total order for sorting: comparable values by value, otherwise by type
// (numbers/booleans/instants < strings < anything else), like SQLite's mixed-type order.
const typeRank = (value: unknown): number =>
  typeof value === "number" ||
  typeof value === "bigint" ||
  typeof value === "boolean" ||
  isInstant(value)
    ? 0
    : typeof value === "string"
      ? 1
      : 2;

function compareTotal(a: unknown, b: unknown): number {
  const c = compareScalars(a, b);
  if (c !== null) return c;

  return typeRank(a) - typeRank(b);
}

// ── LIKE ─────────────────────────────────────────────────────────────────────

const ANY = 0; // `%`
const ONE = 1; // `_`
type LikeToken = string | typeof ANY | typeof ONE;

const foldAscii = (c: string): string => (c >= "A" && c <= "Z" ? c.toLowerCase() : c);
const foldUnicode = (c: string): string => c.toLowerCase();
const noFold = (c: string): string => c;

/**
 * SQL `LIKE` over code points: `%` any run, `_` one character, `\` escapes the next character
 * (a trailing `\` is a literal backslash). `fold` is applied per character to both sides.
 */
function likeMatch(text: string, pattern: string, fold: (c: string) => string): boolean {
  const chars = Array.from(pattern);
  const tokens: LikeToken[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i]!;
    if (c === "\\" && i + 1 < chars.length) {
      i += 1;
      tokens.push(fold(chars[i]!));
    } else if (c === "%") {
      tokens.push(ANY);
    } else if (c === "_") {
      tokens.push(ONE);
    } else {
      tokens.push(fold(c));
    }
  }
  const t = Array.from(text, fold);

  // Greedy wildcard matching with backtracking to the last `%`.
  let ti = 0;
  let pi = 0;
  let starP = -1;
  let starT = 0;
  while (ti < t.length) {
    const token = tokens[pi];
    if (pi < tokens.length && (token === ONE || token === t[ti])) {
      ti += 1;
      pi += 1;
    } else if (token === ANY) {
      starP = pi;
      starT = ti;
      pi += 1;
    } else if (starP !== -1) {
      pi = starP + 1;
      starT += 1;
      ti = starT;
    } else {
      return false;
    }
  }
  while (tokens[pi] === ANY) pi += 1;

  return pi === tokens.length;
}

const textOf = (value: unknown): string | undefined =>
  typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "bigint"
      ? String(value)
      : undefined;

// ── conditions ──────────────────────────────────────────────────────────────

/** `x IN (…)`: TRUE on a match, else UNKNOWN if a NULL/incomparable item, else FALSE. */
function inList(value: unknown, list: readonly unknown[]): Tri {
  if (list.length === 0) return false;
  if (isNull(value)) return null;
  let unknown = false;
  for (const item of list) {
    const c = isNull(item) ? null : compareScalars(value, item);
    if (c === 0) return true;
    if (c === null) unknown = true;
  }

  return unknown ? null : false;
}

const member = (list: readonly unknown[], value: unknown): boolean =>
  list.some((item) => !isNull(item) && compareScalars(item, value) === 0);

function arrayOp(
  op: "arrayContains" | "arrayContained" | "arrayOverlaps",
  value: unknown,
  values: readonly (string | number)[],
  dialect: MemoryDialect,
): Tri {
  if (dialect === "postgres") {
    // `@>`/`<@`/`&&`: NULL array → NULL; NULL elements never equal anything.
    if (!Array.isArray(value)) return null;
    if (op === "arrayContains") return values.every((v) => member(value, v));
    if (op === "arrayContained") return value.every((e) => !isNull(e) && member(values, e));

    return value.some((e) => !isNull(e) && member(values, e));
  }

  // sqlite: the json_each(…) subqueries the adapters render. A NULL column yields no rows
  // (an empty list); a NULL element makes `NOT IN` UNKNOWN, which the subquery skips.
  if (!isNull(value) && !Array.isArray(value)) return null;
  const list: readonly unknown[] = value ?? [];
  if (op === "arrayContains") {
    return values.every((v) => member(list, v) || list.some(isNull));
  }
  if (op === "arrayContained") return list.every((e) => isNull(e) || member(values, e));

  return list.some((e) => !isNull(e) && member(values, e));
}

function condEval<Row>(
  cond: CompiledCond,
  get: (row: Row) => unknown,
  dialect: MemoryDialect,
): Eval<Row> {
  const compare = (test: (c: number) => boolean, value: unknown) => (row: Row) => {
    const v = get(row);
    if (isNull(v)) return null;
    const c = compareScalars(v, value);

    return c === null ? null : test(c);
  };

  switch (cond.op) {
    case "eq":
      return compare((c) => c === 0, cond.value);
    case "ne":
      return compare((c) => c !== 0, cond.value);
    case "lt":
      return compare((c) => c < 0, cond.value);
    case "gt":
      return compare((c) => c > 0, cond.value);
    case "lte":
      return compare((c) => c <= 0, cond.value);
    case "gte":
      return compare((c) => c >= 0, cond.value);
    case "contains":
    case "startsWith":
    case "endsWith":
    case "like":
    case "ilike":
    case "notIlike": {
      const { op, pattern } = sqlTextOp(cond.op, cond.value);
      // SQLite's LIKE folds ASCII for every op; Postgres's LIKE is exact and ILIKE folds Unicode.
      const fold = dialect === "sqlite" ? foldAscii : op === "like" ? noFold : foldUnicode;

      return (row) => {
        const text = textOf(get(row));
        if (text === undefined) return null;
        const match = likeMatch(text, pattern, fold);

        return op === "notIlike" ? !match : match;
      };
    }
    case "inArray": {
      const { values } = cond;

      return (row) => inList(get(row), values);
    }
    case "notInArray": {
      const { values } = cond;

      return (row) => not3(inList(get(row), values));
    }
    case "arrayContains":
    case "arrayContained":
    case "arrayOverlaps": {
      const { op, values } = cond;

      return (row) => arrayOp(op, get(row), values, dialect);
    }
    case "isNull":
      return (row) => isNull(get(row));
    case "isNotNull":
      return (row) => !isNull(get(row));
  }
}

const not3 = (value: Tri): Tri => (value === null ? null : !value);

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to a row predicate, looking each field up in
 * `paths` (public field name → {@link MemoryAccessor}). Conditions on fields missing from
 * `paths` are dropped; `null` (or an AST that drops to nothing) gives a predicate that matches
 * every row. Evaluation uses SQL's three-valued logic: a comparison with NULL is UNKNOWN, `not`
 * keeps UNKNOWN, and a row matches only when the whole tree is TRUE. Most code calls
 * `buildFilterPredicate`, which compiles and renders in one step.
 *
 * @example
 * ```ts
 * import { toFilterPredicate } from "@xtandard/lib/filters/memory";
 *
 * const predicate = toFilterPredicate({
 *   where: { type: "not", node: { type: "cond", cond: { field: "amount", op: "gt", value: 5 } } },
 *   paths: { amount: "amount" },
 * });
 * predicate({ amount: 3 }); // → true
 * predicate({ amount: 9 }); // → false
 * predicate({ amount: null }); // → false (NOT UNKNOWN is UNKNOWN)
 * ```
 */
export function toFilterPredicate<Row = any>(input: {
  where: CompiledWhere | null;
  paths: Record<string, MemoryAccessor<Row>>;
  dialect?: MemoryDialect;
}): FilterPredicate<Row> {
  const dialect = input.dialect ?? "postgres";
  const render = (node: CompiledWhere): Eval<Row> | undefined => {
    switch (node.type) {
      case "cond": {
        const accessor = input.paths[node.cond.field];

        return accessor === undefined
          ? undefined
          : condEval(node.cond, getterOf(accessor), dialect);
      }
      case "and": {
        const parts = node.nodes.map(render).filter((p): p is Eval<Row> => p !== undefined);
        if (parts.length === 0) return undefined;

        return (row) => {
          let result: Tri = true;
          for (const part of parts) {
            const value = part(row);
            if (value === false) return false;
            if (value === null) result = null;
          }

          return result;
        };
      }
      case "or": {
        const parts = node.nodes.map(render).filter((p): p is Eval<Row> => p !== undefined);
        if (parts.length === 0) return undefined;

        return (row) => {
          let result: Tri = false;
          for (const part of parts) {
            const value = part(row);
            if (value === true) return true;
            if (value === null) result = null;
          }

          return result;
        };
      }
      case "not": {
        const inner = render(node.node);

        return inner === undefined ? undefined : (row) => not3(inner(row));
      }
    }
  };

  const evaluate = input.where ? render(input.where) : undefined;

  return evaluate ? (row) => evaluate(row) === true : () => true;
}

const pathsOf = <Row>(spec: MemoryFilterSpec<Row>): Record<string, MemoryAccessor<Row>> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.path]));
const kindsOf = <Row>(spec: MemoryFilterSpec<Row>): Record<string, FieldKind> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.kind]));

/**
 * Compile a flat, AND-combined list of column filters into a row predicate. Only fields in
 * `spec` whose kind matches the filter's `kind` are kept; the rest are silently dropped, and
 * when nothing survives the predicate matches every row. A `date` preset filter needs
 * `resolveDate` (it throws without one). `dialect` (default `"postgres"`) picks the SQL
 * semantics to copy (see {@link MemoryDialect}).
 *
 * @example
 * ```ts
 * import type { ColumnFilter } from "@xtandard/lib/filters";
 * import { buildFilterPredicate, numberField, textField } from "@xtandard/lib/filters/memory";
 *
 * type Task = { name: string; amount: number | null };
 * const tasks: Task[] = [
 *   { name: "Rent", amount: 1200 },
 *   { name: "Refund", amount: null },
 *   { name: "Groceries", amount: 150 },
 * ];
 * const spec = { name: textField({ path: "name" }), amount: numberField({ path: "amount" }) };
 * const filters: ColumnFilter[] = [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ];
 * const { predicate } = buildFilterPredicate<Task>({ spec, filters });
 * tasks.filter(predicate).map((t) => t.name); // → ["Rent"]
 * ```
 */
export function buildFilterPredicate<Row = any>(input: {
  spec: MemoryFilterSpec<Row>;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
  dialect?: MemoryDialect;
}): { predicate: FilterPredicate<Row> } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return {
    predicate: toFilterPredicate({ where, paths: pathsOf(input.spec), dialect: input.dialect }),
  };
}

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into a row predicate. Same
 * allow-list, `resolveDate` and `dialect` rules as `buildFilterPredicate`.
 *
 * @example
 * ```ts
 * import { buildFilterNodePredicate, numberField, textField } from "@xtandard/lib/filters/memory";
 *
 * const spec = { name: textField({ path: "name" }), amount: numberField({ path: "amount" }) };
 * const { predicate } = buildFilterNodePredicate({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * predicate({ name: "Rent", amount: -5 }); // → true
 * predicate({ name: "Fee", amount: 10 }); // → true
 * predicate({ name: "Fee", amount: null }); // → false (both branches are FALSE or UNKNOWN)
 * ```
 */
export function buildFilterNodePredicate<Row = any>(input: {
  spec: MemoryFilterSpec<Row>;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
  dialect?: MemoryDialect;
}): { predicate: FilterPredicate<Row> } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return {
    predicate: toFilterPredicate({ where, paths: pathsOf(input.spec), dialect: input.dialect }),
  };
}

/**
 * Compile `filters` with {@link buildFilterPredicate} and return the rows that match, as a new
 * array in their original order. The array counterpart of `applyFiltersToKnex`.
 *
 * @example
 * ```ts
 * import { applyFiltersToArray, enumField } from "@xtandard/lib/filters/memory";
 *
 * const rows = [{ id: 1, status: "open" }, { id: 2, status: "done" }, { id: 3, status: null }];
 * applyFiltersToArray(rows, {
 *   spec: { status: enumField({ path: "status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "ne", value: "done" } }],
 * }).map((r) => r.id); // → [1]
 * ```
 */
export function applyFiltersToArray<Row>(
  rows: readonly Row[],
  input: {
    spec: MemoryFilterSpec<Row>;
    filters: ColumnFilter[];
    resolveDate?: DateFilterResolver;
    dialect?: MemoryDialect;
  },
): Row[] {
  return rows.filter(buildFilterPredicate(input).predicate);
}

// ── sorting ─────────────────────────────────────────────────────────────────

/**
 * Compare two values of one sort key in its natural (ascending) value order, with NULL ranked
 * as the largest or smallest value.
 */
function keyCompare(a: unknown, b: unknown, nullLargest: boolean): number {
  const an = isNull(a);
  const bn = isNull(b);
  if (an || bn) return an && bn ? 0 : an === nullLargest ? 1 : -1;

  return compareTotal(a, b);
}

/** Whether NULL ranks as the largest value of a key sorted `order`. */
function nullIsLargest(
  order: "asc" | "desc",
  dialect: MemoryDialect,
  nulls: NullsOrder | undefined,
): boolean {
  // Postgres: NULL is larger than everything; SQLite: smaller. `nulls` pins the placement in
  // the sorted output, so it depends on the direction.
  if (nulls === undefined) return dialect === "postgres";

  return (order === "asc") === (nulls === "last");
}

type SortKey<Row> = { get: (row: Row) => unknown; dir: 1 | -1; nullLargest: boolean };

const comparatorOf =
  <Row>(keys: SortKey<Row>[]): RowComparator<Row> =>
  (a, b) => {
    for (const key of keys) {
      const c = keyCompare(key.get(a), key.get(b), key.nullLargest);
      if (c !== 0) return c * key.dir;
    }

    return 0;
  };

/**
 * Build an `Array.prototype.sort` comparator from a `Sort`, allow-listed to `paths` (public
 * field name → {@link MemoryAccessor}). Unknown fields are dropped; when nothing is left,
 * `defaultSort` is used instead (and with no keys at all every pair compares equal). Keys
 * apply in order; ties keep the input order, since `Array.prototype.sort` is stable.
 *
 * Values compare like the filter predicate: numbers (and `bigint`s) numerically, strings by
 * code point (SQLite's `BINARY` / Postgres's `"C"` collation, not a locale), instants (`Date`,
 * or anything with `epochMilliseconds`) by time, `false` before `true`. NULLs follow
 * `dialect` (Postgres: last ascending, first descending; SQLite: the opposite), or `nulls`
 * (`"first"`/`"last"`, like `NULLS FIRST`/`NULLS LAST`) whatever the direction.
 *
 * @example
 * ```ts
 * import { buildComparator } from "@xtandard/lib/filters/memory";
 *
 * const rows = [
 *   { id: 1, name: "b", amount: 5 },
 *   { id: 2, name: "a", amount: null },
 *   { id: 3, name: "c", amount: 5 },
 * ];
 * const { compare } = buildComparator({
 *   sort: [{ field: "amount", dir: "desc" }, { field: "password", dir: "asc" }], // password: not sortable
 *   paths: { name: "name", amount: "amount" },
 *   defaultSort: [{ field: "name", dir: "asc" }],
 * });
 * [...rows].sort(compare).map((r) => r.id); // → [2, 1, 3] (Postgres: NULLs first descending; ties keep input order)
 * ```
 */
export function buildComparator<Row = any>(input: {
  sort: Sort;
  paths: Record<string, MemoryAccessor<Row>>;
  defaultSort?: Sort;
  dialect?: MemoryDialect;
  nulls?: NullsOrder;
}): { compare: RowComparator<Row> } {
  const dialect = input.dialect ?? "postgres";
  const resolve = (sort: Sort): SortKey<Row>[] =>
    sort.flatMap((item) => {
      const accessor = input.paths[item.field];
      if (accessor === undefined) return [];

      return [
        {
          get: getterOf(accessor),
          dir: item.dir === "asc" ? 1 : -1,
          nullLargest: nullIsLargest(item.dir, dialect, input.nulls),
        },
      ];
    });

  const keys = resolve(input.sort);

  return { compare: comparatorOf(keys.length > 0 ? keys : resolve(input.defaultSort ?? [])) };
}

// ── keyset / pagination ─────────────────────────────────────────────────────

/** The keyset helper returned by {@link createMemoryKeyset}. */
export interface MemoryKeyset<Row = any> {
  /** Logical cursor keys, in sort order. */
  keys: () => string[];
  /** The row comparator for a fetch direction (`"backward"` is the exact reverse). */
  compare: (direction?: CursorDirection) => RowComparator<Row>;
  /** The seek predicate after (or before) a decoded cursor; `undefined` for a `null` cursor. */
  where: (
    cursor: Record<string, unknown> | null | undefined,
    direction?: CursorDirection,
  ) => FilterPredicate<Row> | undefined;
  /** The cursor data for a row (`{ key: value }` for every key, a missing value as `null`). */
  fromItem: (row: Row) => Record<string, unknown>;
}

/**
 * Build a keyset (cursor) helper over in-memory rows from a sort spec (the same
 * `{ key, order }[]` as `createKeysetSpec`, whose seek AST it evaluates). Each key reads
 * `paths[key]`, or the key itself as a path. The last key MUST be unique (a tiebreaker like
 * `id`) so the cursor is stable.
 *
 * The seek compares in the comparator's own total order, NULLs included (ranked per `dialect`
 * or `nulls`, as in {@link buildComparator}), so rows with a NULL sort key page correctly —
 * unlike SQL's `>`, which never matches NULL.
 *
 * @example
 * ```ts
 * import { createMemoryKeyset } from "@xtandard/lib/filters/memory";
 *
 * const rows = [{ id: 3, at: 10 }, { id: 1, at: 20 }, { id: 2, at: 10 }];
 * const keyset = createMemoryKeyset({ sort: [{ key: "at", order: "desc" }, { key: "id", order: "asc" }] });
 * const sorted = [...rows].sort(keyset.compare());
 * sorted.map((r) => r.id); // → [1, 2, 3]
 * const after = keyset.where(keyset.fromItem(sorted[0]!))!; // seek past the first row
 * sorted.filter(after).map((r) => r.id); // → [2, 3]
 * keyset.where(null); // → undefined (first page)
 * ```
 */
export function createMemoryKeyset<Row = any>(input: {
  sort: KeysetSortColumn[];
  paths?: Record<string, MemoryAccessor<Row>>;
  dialect?: MemoryDialect;
  nulls?: NullsOrder;
}): MemoryKeyset<Row> {
  const spec = createKeysetSpec({ sort: input.sort });
  const dialect = input.dialect ?? "postgres";
  const keys = new Map(
    spec.sort.map((col) => [
      col.key,
      {
        get: getterOf(input.paths?.[col.key] ?? col.key),
        dir: col.order === "asc" ? 1 : -1,
        nullLargest: nullIsLargest(col.order, dialect, input.nulls),
      } satisfies SortKey<Row>,
    ]),
  );
  const forward = comparatorOf([...keys.values()]);
  const backward: RowComparator<Row> = (a, b) => forward(b, a);

  return {
    keys: () => spec.keys(),
    compare: (direction = "forward") => (direction === "forward" ? forward : backward),
    where: (cursor, direction) => {
      const seek = spec.where(cursor, direction);
      if (!seek) return undefined;

      const branches = seek.or.map((branch) =>
        branch.and.map((p) => {
          const key = keys.get(p.key)!;

          return (row: Row) => {
            const c = keyCompare(key.get(row), p.value, key.nullLargest);

            return p.op === "eq" ? c === 0 : p.op === "gt" ? c > 0 : c < 0;
          };
        }),
      );

      return (row) => branches.some((branch) => branch.every((test) => test(row)));
    },
    fromItem: (row) =>
      Object.fromEntries([...keys].map(([key, { get }]) => [key, get(row) ?? null])),
  };
}

/**
 * Create a fully synchronous paginator over an in-memory array (`createPaginator` from
 * `@xtandard/lib/pagination` with array fetchers): page/offset requests slice the sorted rows
 * (and report `totalItems`), cursor requests seek with {@link createMemoryKeyset}, forward or
 * backward. `paginate` returns a plain `Paginated<Row>` (no `await`), so it works in a render
 * path. The rows are copied and sorted once, at creation; filter them first (for example with
 * `applyFiltersToArray`).
 *
 * @example
 * ```ts
 * import { createMemoryPaginator } from "@xtandard/lib/filters/memory";
 *
 * const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `task ${5 - i}` }));
 * const paginator = createMemoryPaginator({
 *   rows,
 *   sort: [{ key: "name", order: "asc" }, { key: "id", order: "asc" }], // unique tiebreaker last
 * });
 * const first = paginator.paginate({ type: "cursor", limit: 2 });
 * first.items.map((r) => r.name); // → ["task 1", "task 2"]
 * const next = paginator.paginate({ type: "cursor", limit: 2, cursor: first.pageInfo.endCursor });
 * next.items.map((r) => r.name); // → ["task 3", "task 4"]
 * paginator.paginate({ type: "page", page: 3, pageSize: 2 }).pageInfo;
 * // → { hasNextPage: false, hasPreviousPage: true, page: 3, pageSize: 2, totalItems: 5, totalPages: 3,
 * //     startCursor: "…", endCursor: "…" }
 * ```
 */
export function createMemoryPaginator<Row>(input: {
  rows: readonly Row[];
  sort: KeysetSortColumn[];
  paths?: Record<string, MemoryAccessor<Row>>;
  dialect?: MemoryDialect;
  nulls?: NullsOrder;
  /** Hard cap applied to any requested limit/pageSize. Default: no cap. */
  maxLimit?: number;
  /** Cursor token codec. Default: `createCursorCodec()` (JSON + base64url). */
  codec?: CursorCodec<Record<string, unknown>>;
}): PaginatorSync<Row> {
  const keyset = createMemoryKeyset(input);
  const sorted = [...input.rows].sort(keyset.compare());

  return createPaginator<Row>({
    fetchOffset: ({ limit, offset }) => ({
      items: sorted.slice(offset, offset + limit),
      totalItems: sorted.length,
    }),
    fetchCursor: ({ limit, cursor, direction }) => {
      const seek = keyset.where(cursor, direction);
      const pool = seek ? sorted.filter(seek) : sorted;

      // backward: the rows just before the cursor, in flipped order (the paginator restores it)
      return {
        items: direction === "forward" ? pool.slice(0, limit) : pool.slice(-limit).reverse(),
      };
    },
    cursor: { fromItem: keyset.fromItem, codec: input.codec },
    maxLimit: input.maxLimit,
  });
}
