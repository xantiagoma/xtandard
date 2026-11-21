/**
 * TanStack Table bridge — convert a table's state to and from the filter model,
 * so a table can be filtered, sorted and paginated **on the server**
 * (`manualFiltering` / `manualSorting` / `manualPagination`), synced to the URL
 * with the compact codec, and fed to any adapter.
 *
 * - `columnFilters` ⇄ `ColumnFilter[]` through a per-column mapping spec
 *   ({@link createTableBridge} + the `*Column` builders);
 * - `globalFilter` → an `or` of text filters over the fields you name;
 * - `sorting` ⇄ `Sort`;
 * - `pagination` ⇄ page/offset `PaginationInput`, or a cursor stack for
 *   cursor-paginated APIs.
 *
 * Zero dependencies: the table state is typed **structurally**
 * ({@link TableColumnFiltersState}, {@link TableSortingState},
 * {@link TablePaginationState}), and those shapes are identical in
 * `@tanstack/table-core` v8 and v9, so any TanStack Table adapter (React, Vue,
 * Solid, Svelte, Angular, Lit) works without a peer dependency.
 */

import type {
  CursorPagination,
  OffsetPagination,
  PageInfo,
  PagePagination,
} from "../pagination.ts";
import type {
  DateUnit,
  FieldFilter,
  FieldKind,
  FilterNode,
  FiltersRequest,
  Sort,
} from "./types.ts";
import type { AnyOperator } from "./url.ts";
import { expandFilters, OPERATOR_CODE, UNIT_CODE } from "./url.ts";

// ── structural TanStack Table state (v8 = v9) ───────────────────────────────

/** One entry of TanStack Table's `columnFilters` state (`ColumnFilter` in table-core v8 and v9). */
export type TableColumnFilter = { id: string; value: unknown };

/** TanStack Table's `columnFilters` state (`ColumnFiltersState` in table-core v8 and v9). */
export type TableColumnFiltersState = TableColumnFilter[];

/** One entry of TanStack Table's `sorting` state (`ColumnSort` in table-core v8 and v9). */
export type TableColumnSort = { id: string; desc: boolean };

/** TanStack Table's `sorting` state (`SortingState` in table-core v8 and v9). */
export type TableSortingState = TableColumnSort[];

/** TanStack Table's `pagination` state (`PaginationState` in table-core v8 and v9). `pageIndex` is 0-based. */
export type TablePaginationState = { pageIndex: number; pageSize: number };

// ── column specs ────────────────────────────────────────────────────────────

/** The filter variant of one field kind (`FilterOfKind<"number">` = `NumberFilter`). */
export type FilterOfKind<K extends FieldKind> = Extract<FieldFilter, { kind: K }>;

/**
 * How one table column's filter value maps to the filter model and back. Built
 * by the `*Column` builders ({@link textColumn}, {@link numberRangeColumn}, …)
 * or {@link customColumn}.
 *
 * - `kind` — the model kind the column filters on (also its `kinds` entry);
 * - `field` — the model field name, when it differs from the table column id;
 * - `toFilter` — table value → filter, or `null` when the value means "no
 *   filter" (empty, or not the expected shape: the value is `unknown` because
 *   it may come from a URL or a hand-written `setFilterValue`);
 * - `fromFilter` — filter → table value, or `undefined` when this column can't
 *   represent that filter (the filter is then dropped).
 */
export type TableColumnSpec<
  TValue = unknown,
  TKind extends FieldKind = FieldKind,
  TField extends string | undefined = string | undefined,
> = {
  readonly kind: TKind;
  readonly field: TField;
  toFilter(value: unknown): FilterOfKind<TKind> | null;
  fromFilter(filter: FilterOfKind<TKind>): TValue | undefined;
};

/** Any {@link TableColumnSpec}, whatever its value type and kind. */
export type AnyTableColumnSpec = {
  readonly kind: FieldKind;
  readonly field: string | undefined;
  toFilter(value: unknown): FieldFilter | null;
  fromFilter(filter: never): unknown;
};

/** A column id → {@link TableColumnSpec} map (the `columns` of {@link createTableBridge}). */
export type TableColumns = Record<string, AnyTableColumnSpec>;

/** The table filter value type of one column spec. */
export type InferColumnValue<S> = S extends TableColumnSpec<infer V, any, any> ? V : never;

/**
 * Column id → table filter value type, inferred from a `columns` map (what
 * `column.getFilterValue()` holds for each column).
 *
 * @example
 * ```ts
 * import { createTableBridge, numberRangeColumn, textColumn } from "@xtandard/lib/filters/tanstack-table";
 * import type { InferTableFilterValues } from "@xtandard/lib/filters/tanstack-table";
 *
 * const bridge = createTableBridge({ columns: { name: textColumn(), price: numberRangeColumn() } });
 * type Values = InferTableFilterValues<typeof bridge.columns>;
 * // → { name: string; price: [number | undefined, number | undefined] }
 * ```
 */
export type InferTableFilterValues<C extends TableColumns> = {
  -readonly [K in keyof C]: InferColumnValue<C[K]>;
};

type FieldOf<S, K extends string> = S extends { field: infer F } ? (F extends string ? F : K) : K;

type ColumnKinds<C extends TableColumns> = {
  -readonly [K in keyof C & string as FieldOf<C[K], K>]: C[K]["kind"];
};

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Model field → kind, inferred from the `columns` map (a column's `field`, or
 * its id) plus the global-filter fields (`text`). This is the allow-list for
 * `compileFilters`, `createFilterUrlCodec` and the adapters' specs.
 */
export type InferTableKinds<C extends TableColumns, G extends readonly string[] = []> = Simplify<
  ColumnKinds<C> & { [F in Exclude<G[number], keyof ColumnKinds<C>>]: "text" }
>;

// ── value helpers ───────────────────────────────────────────────────────────

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

/** A finite number, or a non-blank numeric string (what an `<input>` hands you); else `null`. */
function toNumber(x: unknown): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x !== "string" || x.trim() === "") return null;

  const n = Number(x);

  return Number.isFinite(n) ? n : null;
}

function compact<T>(xs: readonly (T | null)[]): T[] {
  return xs.filter((x): x is T => x !== null);
}

/** Validate an operator-shaped value (`{ operator, value | values | from+to | preset args }`)
 * against `kind` by reusing the compact codec's defensive decoder. */
function parseOperatorValue<K extends FieldKind>(kind: K, value: unknown): FilterOfKind<K> | null {
  if (!isRecord(value) || !isString(value.operator)) return null;
  if (!Object.hasOwn(OPERATOR_CODE, value.operator)) return null;

  const leaf: Record<string, unknown> = {
    f: "_",
    o: OPERATOR_CODE[value.operator as AnyOperator],
  };
  if ("value" in value) leaf.v = value.value;
  if ("values" in value) leaf.vs = value.values;
  if ("from" in value) leaf.fr = value.from;
  if ("to" in value) leaf.to = value.to;
  if ("unit" in value) {
    if (!isString(value.unit) || !Object.hasOwn(UNIT_CODE, value.unit)) return null;
    leaf.u = UNIT_CODE[value.unit as DateUnit];
  }
  if ("timeZone" in value) leaf.tz = value.timeZone;
  if ("anchor" in value) leaf.a = value.anchor;
  if (value.end !== undefined) leaf.e = value.end;
  if (value.weekStartsOn !== undefined) leaf.ws = value.weekStartsOn;

  const filter = expandFilters({ compact: [leaf], kinds: { _: kind } }).filters[0]?.filter;

  return (filter as FilterOfKind<K> | undefined) ?? null;
}

/** `filter` without its `kind` key — the operator-shaped table value. */
type WithoutKind<F> = F extends unknown ? Omit<F, "kind"> : never;

function withoutKind<F extends FieldFilter>(filter: F): WithoutKind<F> {
  const { kind: _kind, ...rest } = filter;

  return rest as WithoutKind<F>;
}

// ── column builders ─────────────────────────────────────────────────────────

type FieldOption<F extends string | undefined> = {
  /** Model field name when it differs from the table column id. */
  field?: F;
};

/** The `text` operators that take one string `value`. */
export type TextValueOperator = Extract<FilterOfKind<"text">, { value: string }>["operator"];

/** The `number` operators that take one number `value`. */
export type NumberValueOperator = Extract<FilterOfKind<"number">, { value: number }>["operator"];

/**
 * A text input (TanStack's `includesString`): a non-empty string becomes a
 * `text` filter with `operator` (default `contains`). `""` and non-strings mean
 * "no filter".
 *
 * @example
 * ```ts
 * import { textColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * textColumn().toFilter("ada"); // → { kind: "text", operator: "contains", value: "ada" }
 * textColumn({ operator: "startsWith" }).toFilter("Q3"); // → { kind: "text", operator: "startsWith", value: "Q3" }
 * textColumn().toFilter(""); // → null
 * ```
 */
export function textColumn<const F extends string | undefined = undefined>(
  options: FieldOption<F> & { operator?: TextValueOperator } = {},
): TableColumnSpec<string, "text", NoInfer<F>> {
  const operator = options.operator ?? "contains";

  return {
    kind: "text",
    field: options.field as F,
    toFilter: (value) =>
      isString(value) && value !== "" ? { kind: "text", operator, value } : null,
    fromFilter: (filter) =>
      filter.operator === operator && "value" in filter ? filter.value : undefined,
  };
}

/**
 * A single number input: a number (or numeric string, as an `<input>` gives
 * it) becomes a `number` filter with `operator` (default `eq`).
 *
 * @example
 * ```ts
 * import { numberColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * numberColumn({ operator: "gte" }).toFilter("3"); // → { kind: "number", operator: "gte", value: 3 }
 * numberColumn().toFilter("abc"); // → null
 * ```
 */
export function numberColumn<const F extends string | undefined = undefined>(
  options: FieldOption<F> & { operator?: NumberValueOperator } = {},
): TableColumnSpec<number, "number", NoInfer<F>> {
  const operator = options.operator ?? "eq";

  return {
    kind: "number",
    field: options.field as F,
    toFilter: (value) => {
      const n = toNumber(value);

      return n === null ? null : { kind: "number", operator, value: n };
    },
    fromFilter: (filter) =>
      filter.operator === operator && "value" in filter ? filter.value : undefined,
  };
}

/** A `[min, max]` range value; either bound may be absent (open-ended). */
export type NumberRangeValue = [min: number | undefined, max: number | undefined];

/**
 * A min/max range (TanStack's `inNumberRange`): `[min, max]` becomes `between`,
 * `[min, ]` becomes `gte`, `[, max]` becomes `lte`. Bounds may be numbers or
 * numeric strings; blank bounds are open, and swapped bounds are put in order
 * (as `inNumberRange` does). `[ , ]` means "no filter".
 *
 * @example
 * ```ts
 * import { numberRangeColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * const price = numberRangeColumn();
 * price.toFilter([10, 100]); // → { kind: "number", operator: "between", from: 10, to: 100 }
 * price.toFilter(["10", ""]); // → { kind: "number", operator: "gte", value: 10 }
 * price.toFilter([undefined, 100]); // → { kind: "number", operator: "lte", value: 100 }
 * price.toFilter([100, 10]); // → { kind: "number", operator: "between", from: 10, to: 100 }
 * price.fromFilter({ kind: "number", operator: "gte", value: 10 }); // → [10, undefined]
 * ```
 */
export function numberRangeColumn<const F extends string | undefined = undefined>(
  options: FieldOption<F> = {},
): TableColumnSpec<NumberRangeValue, "number", NoInfer<F>> {
  return {
    kind: "number",
    field: options.field as F,
    toFilter: (value) => {
      if (!Array.isArray(value)) return null;

      let min = toNumber(value[0]);
      let max = toNumber(value[1]);
      if (min !== null && max !== null) {
        if (min > max) [min, max] = [max, min];

        return { kind: "number", operator: "between", from: min, to: max };
      }
      if (min !== null) return { kind: "number", operator: "gte", value: min };
      if (max !== null) return { kind: "number", operator: "lte", value: max };

      return null;
    },
    fromFilter: (filter) => {
      if (filter.operator === "between") return [filter.from, filter.to];
      if (filter.operator === "gte") return [filter.value, undefined];
      if (filter.operator === "lte") return [undefined, filter.value];

      return undefined;
    },
  };
}

/** The kinds a select / multi-select column can filter on. */
export type SelectKind = "enum" | "text" | "number";

type SelectValue<K extends SelectKind> = K extends "number" ? number : string;

function selectValue(kind: SelectKind, value: unknown): string | number | null {
  if (kind === "number") return toNumber(value);

  return isString(value) && value !== "" ? value : null;
}

/**
 * A single-choice select (TanStack's `equals`): the chosen value becomes an
 * `eq` filter of `kind` (default `enum`; `text` and `number` work too).
 *
 * @example
 * ```ts
 * import { selectColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * selectColumn().toFilter("open"); // → { kind: "enum", operator: "eq", value: "open" }
 * selectColumn({ kind: "number" }).toFilter("2"); // → { kind: "number", operator: "eq", value: 2 }
 * ```
 */
export function selectColumn<
  const K extends SelectKind = "enum",
  const F extends string | undefined = undefined,
>(
  options: FieldOption<F> & { kind?: K } = {},
): TableColumnSpec<SelectValue<NoInfer<K>>, NoInfer<K>, NoInfer<F>> {
  const kind = (options.kind ?? "enum") as K;

  return {
    kind,
    field: options.field as F,
    toFilter: (value) => {
      const v = selectValue(kind, value);
      if (v === null) return null;

      return { kind, operator: "eq", value: v } as FilterOfKind<K>;
    },
    fromFilter: (filter) => {
      const f = filter as FieldFilter;

      return f.operator === "eq" && "value" in f ? (f.value as SelectValue<K>) : undefined;
    },
  };
}

/**
 * A multi-select (TanStack's `arrIncludesSome` on a scalar column): the chosen
 * values become an `inArray` filter (or `notInArray` with `operator`) of
 * `kind` (default `enum`). Values of the wrong type are skipped; an empty
 * selection means "no filter".
 *
 * @example
 * ```ts
 * import { multiSelectColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * multiSelectColumn().toFilter(["open", "done"]);
 * // → { kind: "enum", operator: "inArray", values: ["open", "done"] }
 * multiSelectColumn({ kind: "number", operator: "notInArray" }).toFilter([1, "2"]);
 * // → { kind: "number", operator: "notInArray", values: [1, 2] }
 * multiSelectColumn().toFilter([]); // → null
 * ```
 */
export function multiSelectColumn<
  const K extends SelectKind = "enum",
  const F extends string | undefined = undefined,
>(
  options: FieldOption<F> & { kind?: K; operator?: "inArray" | "notInArray" } = {},
): TableColumnSpec<SelectValue<NoInfer<K>>[], NoInfer<K>, NoInfer<F>> {
  const kind = (options.kind ?? "enum") as K;
  const operator = options.operator ?? "inArray";

  return {
    kind,
    field: options.field as F,
    toFilter: (value) => {
      if (!Array.isArray(value)) return null;

      const values = compact(value.map((v) => selectValue(kind, v)));
      if (values.length === 0) return null;

      return { kind, operator, values } as FilterOfKind<K>;
    },
    fromFilter: (filter) => {
      const f = filter as FieldFilter;

      return f.operator === operator && "values" in f
        ? ([...f.values] as SelectValue<K>[])
        : undefined;
    },
  };
}

/**
 * A yes/no filter: a boolean becomes `eq`. Anything else (including
 * `undefined`, the "any" state of a tri-state control) means "no filter".
 *
 * @example
 * ```ts
 * import { booleanColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * booleanColumn().toFilter(true); // → { kind: "boolean", operator: "eq", value: true }
 * booleanColumn().toFilter("true"); // → null
 * ```
 */
export function booleanColumn<const F extends string | undefined = undefined>(
  options: FieldOption<F> = {},
): TableColumnSpec<boolean, "boolean", NoInfer<F>> {
  return {
    kind: "boolean",
    field: options.field as F,
    toFilter: (value) =>
      typeof value === "boolean" ? { kind: "boolean", operator: "eq", value } : null,
    fromFilter: (filter) => (filter.operator === "eq" ? filter.value : undefined),
  };
}

/**
 * A date preset as a table value: the model's `DatePreset` without `kind`;
 * `timeZone` may be left out when the column has a default.
 */
export type DatePresetValue = {
  operator: "is" | "before" | "after" | "between";
  unit: DateUnit;
  anchor: string;
  end?: string;
  weekStartsOn?: number;
  timeZone?: string;
};

/**
 * A date preset picker: the value is a {@link DatePresetValue} (e.g. "this
 * month", or a `between` range with `end`) and becomes a `date` filter. With
 * `timeZone`, the value may omit it (and `fromFilter` leaves it out again
 * when it matches). The preset is resolved later by your `resolveDate`.
 *
 * @example
 * ```ts
 * import { dateColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * const createdAt = dateColumn({ timeZone: "Europe/Madrid" });
 * createdAt.toFilter({ operator: "is", unit: "month", anchor: "2026-02-01T00:00:00" });
 * // → { kind: "date", operator: "is", unit: "month", timeZone: "Europe/Madrid", anchor: "2026-02-01T00:00:00" }
 * createdAt.toFilter({ operator: "is", unit: "fortnight", anchor: "2026-02-01T00:00:00" }); // → null
 * ```
 */
export function dateColumn<const F extends string | undefined = undefined>(
  options: FieldOption<F> & { timeZone?: string } = {},
): TableColumnSpec<DatePresetValue, "date", NoInfer<F>> {
  const defaultTimeZone = options.timeZone;

  return {
    kind: "date",
    field: options.field as F,
    toFilter: (value) => {
      if (!isRecord(value)) return null;

      const timeZone = value.timeZone ?? defaultTimeZone;
      const filter = parseOperatorValue("date", { ...value, timeZone });

      return filter && "unit" in filter ? filter : null;
    },
    fromFilter: (filter) => {
      if (!("unit" in filter)) return undefined;

      const { kind: _kind, timeZone, ...rest } = filter;

      return timeZone === defaultTimeZone ? rest : { ...rest, timeZone };
    },
  };
}

/** The array-column operators (`arrayOverlaps` = has any, `arrayContains` = has all). */
export type ArrayColumnOperator = "arrayContains" | "arrayContained" | "arrayOverlaps";

/**
 * A tags-style filter on an array column: the chosen values become
 * `arrayOverlaps` (has any of them, like TanStack's `arrIncludesSome`; the
 * default) or `arrayContains` (has all of them, like `arrIncludesAll`).
 *
 * @example
 * ```ts
 * import { arrayColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * arrayColumn().toFilter(["a", "b"]); // → { kind: "array", operator: "arrayOverlaps", values: ["a", "b"] }
 * arrayColumn({ operator: "arrayContains" }).toFilter(["a"]);
 * // → { kind: "array", operator: "arrayContains", values: ["a"] }
 * ```
 */
export function arrayColumn<const F extends string | undefined = undefined>(
  options: FieldOption<F> & { operator?: ArrayColumnOperator } = {},
): TableColumnSpec<(string | number)[], "array", NoInfer<F>> {
  const operator = options.operator ?? "arrayOverlaps";

  return {
    kind: "array",
    field: options.field as F,
    toFilter: (value) => {
      if (!Array.isArray(value)) return null;

      const values = value.filter(
        (v): v is string | number =>
          (isString(v) && v !== "") || (typeof v === "number" && Number.isFinite(v)),
      );

      return values.length > 0 ? { kind: "array", operator, values } : null;
    },
    fromFilter: (filter) =>
      filter.operator === operator && "values" in filter ? [...filter.values] : undefined,
  };
}

/** A filter of `kind` without its `kind` key: `{ operator, value }`, `{ operator, from, to }`, … */
export type OperatorValue<K extends FieldKind> = WithoutKind<FilterOfKind<K>>;

/**
 * An operator-picker column: the value is the whole filter minus `kind`
 * (`{ operator: "gte", value: 3 }`, `{ operator: "isNull" }`, …), so any
 * operator of `kind` round-trips. The value is checked like the compact URL
 * codec checks a leaf: an unknown operator or a wrong-typed argument means "no
 * filter".
 *
 * @example
 * ```ts
 * import { filterColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * const amount = filterColumn({ kind: "number" });
 * amount.toFilter({ operator: "notBetween", from: 1, to: 9 });
 * // → { kind: "number", operator: "notBetween", from: 1, to: 9 }
 * amount.toFilter({ operator: "gte", value: "3" }); // → null (a string for a number)
 * amount.fromFilter({ kind: "number", operator: "isNull" }); // → { operator: "isNull" }
 * ```
 */
export function filterColumn<
  const K extends FieldKind,
  const F extends string | undefined = undefined,
>(options: FieldOption<F> & { kind: K }): TableColumnSpec<OperatorValue<K>, K, NoInfer<F>> {
  const { kind } = options;

  return {
    kind,
    field: options.field as F,
    toFilter: (value) => parseOperatorValue(kind, value),
    fromFilter: (filter) => withoutKind(filter) as OperatorValue<K>,
  };
}

/**
 * Your own mapping, for a value shape the builders don't cover. `toFilter`
 * receives the raw (`unknown`) table value; return `null` for "no filter".
 * `fromFilter` returns `undefined` for a filter the column can't show. The
 * table value type is inferred from `fromFilter`.
 *
 * @example
 * ```ts
 * import { customColumn } from "@xtandard/lib/filters/tanstack-table";
 *
 * // a "min rating" slider whose 0 means "any"
 * const rating = customColumn({
 *   kind: "number",
 *   toFilter: (value) =>
 *     typeof value === "number" && value > 0 ? { kind: "number", operator: "gte", value } : null,
 *   fromFilter: (filter) => (filter.operator === "gte" ? filter.value : undefined),
 * });
 * rating.toFilter(4); // → { kind: "number", operator: "gte", value: 4 }
 * rating.toFilter(0); // → null
 * ```
 */
export function customColumn<
  TValue,
  const K extends FieldKind,
  const F extends string | undefined = undefined,
>(
  options: FieldOption<F> & {
    kind: K;
    toFilter: (value: unknown) => FilterOfKind<K> | null;
    fromFilter: (filter: FilterOfKind<K>) => TValue | undefined;
  },
): TableColumnSpec<TValue, K, NoInfer<F>> {
  return {
    kind: options.kind,
    field: options.field as F,
    toFilter: options.toFilter,
    fromFilter: options.fromFilter,
  };
}

// ── sorting ─────────────────────────────────────────────────────────────────

/**
 * TanStack `sorting` → the model's `Sort` (`desc: true` → `dir: "desc"`).
 * Column ids pass through unchanged; use {@link createTableBridge}'s `toSort`
 * to map ids to model fields.
 *
 * @example
 * ```ts
 * import { toSort } from "@xtandard/lib/filters/tanstack-table";
 *
 * toSort({ sorting: [{ id: "price", desc: true }, { id: "name", desc: false }] });
 * // → { sort: [{ field: "price", dir: "desc" }, { field: "name", dir: "asc" }] }
 * ```
 */
export function toSort(input: { sorting: readonly TableColumnSort[] }): { sort: Sort } {
  return { sort: input.sorting.map((s) => ({ field: s.id, dir: s.desc ? "desc" : "asc" })) };
}

/**
 * The model's `Sort` → TanStack `sorting` (the inverse of {@link toSort}).
 *
 * @example
 * ```ts
 * import { parseSortParam } from "@xtandard/lib/filters";
 * import { fromSort } from "@xtandard/lib/filters/tanstack-table";
 *
 * fromSort(parseSortParam({ value: "price:desc" })); // → { sorting: [{ id: "price", desc: true }] }
 * ```
 */
export function fromSort(input: { sort: Sort }): { sorting: TableSortingState } {
  return { sorting: input.sort.map((s) => ({ id: s.field, desc: s.dir === "desc" })) };
}

// ── pagination ──────────────────────────────────────────────────────────────

/**
 * TanStack `pagination` (0-based `pageIndex`) → a page (`page` is 1-based) or
 * offset `PaginationInput`, for an API that takes `?page=` / `?offset=`.
 *
 * @example
 * ```ts
 * import { toPagination } from "@xtandard/lib/filters/tanstack-table";
 *
 * toPagination({ pagination: { pageIndex: 2, pageSize: 20 } });
 * // → { pagination: { type: "page", page: 3, pageSize: 20 } }
 * toPagination({ pagination: { pageIndex: 2, pageSize: 20 }, style: "offset" });
 * // → { pagination: { type: "offset", limit: 20, offset: 40 } }
 * ```
 */
export function toPagination(input: { pagination: TablePaginationState; style?: "page" }): {
  pagination: PagePagination;
};
export function toPagination(input: { pagination: TablePaginationState; style: "offset" }): {
  pagination: OffsetPagination;
};
export function toPagination(input: {
  pagination: TablePaginationState;
  style?: "page" | "offset";
}): { pagination: PagePagination | OffsetPagination };
export function toPagination(input: {
  pagination: TablePaginationState;
  style?: "page" | "offset";
}): { pagination: PagePagination | OffsetPagination } {
  const pageIndex = Math.max(0, Math.trunc(input.pagination.pageIndex));
  const pageSize = Math.max(1, Math.trunc(input.pagination.pageSize));

  if (input.style === "offset") {
    return { pagination: { type: "offset", limit: pageSize, offset: pageIndex * pageSize } };
  }

  return { pagination: { type: "page", page: pageIndex + 1, pageSize } };
}

/**
 * A page or offset `PaginationInput` (e.g. from `parsePaginationParams`) →
 * TanStack `pagination`. An offset that isn't a multiple of `limit` lands on the
 * page that contains it.
 *
 * @example
 * ```ts
 * import { fromPagination } from "@xtandard/lib/filters/tanstack-table";
 *
 * fromPagination({ pagination: { type: "page", page: 3, pageSize: 20 } });
 * // → { pagination: { pageIndex: 2, pageSize: 20 } }
 * fromPagination({ pagination: { type: "offset", limit: 20, offset: 45 } });
 * // → { pagination: { pageIndex: 2, pageSize: 20 } }
 * ```
 */
export function fromPagination(input: { pagination: PagePagination | OffsetPagination }): {
  pagination: TablePaginationState;
} {
  const p = input.pagination;
  if (p.type === "page") {
    return {
      pagination: {
        pageIndex: Math.max(0, Math.trunc(p.page) - 1),
        pageSize: Math.max(1, Math.trunc(p.pageSize)),
      },
    };
  }

  const pageSize = Math.max(1, Math.trunc(p.limit));

  return {
    pagination: { pageIndex: Math.floor(Math.max(0, p.offset) / pageSize), pageSize },
  };
}

/**
 * The `pageCount` / `rowCount` table options for a server-paginated table
 * (`manualPagination: true`), from the response's `PageInfo`. With a total
 * (`totalItems`), both are exact; without one (cursor or no `COUNT(*)`),
 * `pageCount` is "this page, plus one more while `hasNextPage`", so
 * `getCanNextPage()` follows the server.
 *
 * @example
 * ```ts
 * import { tablePaginationOptions } from "@xtandard/lib/filters/tanstack-table";
 *
 * const pagination = { pageIndex: 0, pageSize: 20 };
 * tablePaginationOptions({ pagination, pageInfo: { hasNextPage: true, hasPreviousPage: false, totalItems: 45 } });
 * // → { pageCount: 3, rowCount: 45 }
 * tablePaginationOptions({ pagination, pageInfo: { hasNextPage: true, hasPreviousPage: false } });
 * // → { pageCount: 2 }
 * ```
 */
export function tablePaginationOptions(input: {
  pagination: TablePaginationState;
  pageInfo: PageInfo | null | undefined;
}): { pageCount: number; rowCount?: number } {
  const { pagination, pageInfo } = input;
  if (!pageInfo) return { pageCount: pagination.pageIndex + 1 };

  if (pageInfo.totalItems !== undefined) {
    const pageCount =
      pageInfo.totalPages ?? Math.ceil(pageInfo.totalItems / Math.max(1, pagination.pageSize));

    return { pageCount, rowCount: pageInfo.totalItems };
  }

  return { pageCount: pagination.pageIndex + (pageInfo.hasNextPage ? 2 : 1) };
}

/**
 * The cursors a cursor-paginated table has seen: `cursors[i]` is the `after`
 * cursor that fetches page index `i + 1` (page 0 needs none). Keep it in
 * component state and reset it to `[]` whenever filters, sort or page size
 * change.
 */
export type TableCursors = readonly string[];

/**
 * Turn the table's index-based `pagination` into a cursor request, using the
 * cursors recorded so far ({@link rememberCursor}). The request always walks
 * forward from the cursor of the page before. A `pageIndex` the stack can't
 * reach yet (a deep link, a jump) is clamped to the furthest known page and
 * returned as `pageIndex`, so you can correct the table state.
 *
 * @example
 * ```ts
 * import { toCursorPagination } from "@xtandard/lib/filters/tanstack-table";
 *
 * toCursorPagination({ pagination: { pageIndex: 0, pageSize: 20 }, cursors: [] });
 * // → { pagination: { type: "cursor", limit: 20, cursor: null, direction: "forward" }, pageIndex: 0 }
 * toCursorPagination({ pagination: { pageIndex: 2, pageSize: 20 }, cursors: ["c1", "c2"] });
 * // → { pagination: { type: "cursor", limit: 20, cursor: "c2", direction: "forward" }, pageIndex: 2 }
 * toCursorPagination({ pagination: { pageIndex: 5, pageSize: 20 }, cursors: ["c1"] });
 * // → { pagination: { type: "cursor", limit: 20, cursor: "c1", direction: "forward" }, pageIndex: 1 }
 * ```
 */
export function toCursorPagination(input: {
  pagination: TablePaginationState;
  cursors: TableCursors;
}): { pagination: CursorPagination; pageIndex: number } {
  const wanted = Math.max(0, Math.trunc(input.pagination.pageIndex));
  const pageIndex = Math.min(wanted, input.cursors.length);
  const limit = Math.max(1, Math.trunc(input.pagination.pageSize));

  return {
    pagination: {
      type: "cursor",
      limit,
      cursor: pageIndex === 0 ? null : (input.cursors[pageIndex - 1] ?? null),
      direction: "forward",
    },
    pageIndex,
  };
}

/**
 * Record the `endCursor` of the page just fetched at `pageIndex`, so the next
 * page can be requested. Cursors past it are dropped (they belonged to an older
 * walk); on the last page (`hasNextPage: false`) nothing is added.
 *
 * @example
 * ```ts
 * import { rememberCursor } from "@xtandard/lib/filters/tanstack-table";
 *
 * rememberCursor({
 *   cursors: [],
 *   pageIndex: 0,
 *   pageInfo: { hasNextPage: true, hasPreviousPage: false, endCursor: "c1" },
 * }); // → { cursors: ["c1"] }
 * rememberCursor({
 *   cursors: ["c1", "c2"],
 *   pageIndex: 1,
 *   pageInfo: { hasNextPage: false, hasPreviousPage: true, endCursor: "x" },
 * }); // → { cursors: ["c1"] }
 * ```
 */
export function rememberCursor(input: {
  cursors: TableCursors;
  pageIndex: number;
  pageInfo: PageInfo;
}): { cursors: string[] } {
  const known = input.cursors.slice(0, Math.max(0, input.pageIndex));
  const { endCursor, hasNextPage } = input.pageInfo;

  return { cursors: hasNextPage && endCursor ? [...known, endCursor] : known };
}

// ── the bridge ──────────────────────────────────────────────────────────────

/** The `globalFilter` option of {@link createTableBridge}. */
export type TableGlobalFilterOptions<G extends readonly string[] = readonly string[]> = {
  /** Model fields the search box matches (each a `text` field). */
  fields: G;
  /** How each field matches the search text. Default: `contains`. */
  operator?: TextValueOperator;
};

/** What {@link createTableBridge} returns: the spec plus bound converters. */
export type TableBridge<C extends TableColumns, G extends readonly string[] = []> = {
  /** The `columns` spec as given (use with {@link InferTableFilterValues}). */
  readonly columns: C;
  /** Model field → kind: the allow-list for `compileFilters`, `createFilterUrlCodec`, adapters. */
  readonly kinds: InferTableKinds<C, G>;
  /** `columnFilters` → `ColumnFilter[]` (unknown columns and empty values are dropped). */
  toFilters(columnFilters: readonly TableColumnFilter[]): FiltersRequest;
  /** `ColumnFilter[]` → `columnFilters` (filters no column can show are dropped; first one per column wins). */
  fromFilters(filters: FiltersRequest): TableColumnFiltersState;
  /** The global filter's `or` node, or `null` for an empty search / no `globalFilter` option. */
  globalFilterNode(globalFilter: unknown): FilterNode | null;
  /** Column filters AND the global filter, as one `FilterNode` (or `null` when there is nothing). */
  toFilterNode(input: { filters: FiltersRequest; globalFilter?: unknown }): FilterNode | null;
  /** `sorting` → `Sort`, column ids mapped to model fields. */
  toSort(sorting: readonly TableColumnSort[]): Sort;
  /** `Sort` → `sorting`, model fields mapped back to column ids. */
  fromSort(sort: Sort): TableSortingState;
};

/**
 * Bind a per-column mapping spec once and get converters between TanStack
 * Table state and the filter model. The spec is plain data, so share it between
 * the browser (table ⇄ URL) and the server (URL → `FilterNode` → adapter).
 *
 * - `columns`: column id → a `*Column` builder (how that column's filter value
 *   maps to the model). A builder's `field` renames the column to a model field.
 * - `globalFilter`: the model fields a global search box matches (`text`).
 *
 * Throws when two columns map to the same field, or a global-filter field is a
 * column of another kind.
 *
 * @example
 * ```ts
 * import {
 *   createTableBridge,
 *   multiSelectColumn,
 *   numberRangeColumn,
 *   textColumn,
 * } from "@xtandard/lib/filters/tanstack-table";
 *
 * const bridge = createTableBridge({
 *   columns: {
 *     name: textColumn(),
 *     status: multiSelectColumn(),
 *     price: numberRangeColumn({ field: "priceCents" }),
 *   },
 *   globalFilter: { fields: ["name", "sku"] },
 * });
 *
 * bridge.kinds; // → { name: "text", status: "enum", priceCents: "number", sku: "text" }
 *
 * const filters = bridge.toFilters([
 *   { id: "status", value: ["open"] },
 *   { id: "price", value: [1000, undefined] },
 * ]);
 * // → [
 * //   { field: "status", filter: { kind: "enum", operator: "inArray", values: ["open"] } },
 * //   { field: "priceCents", filter: { kind: "number", operator: "gte", value: 1000 } },
 * // ]
 * bridge.fromFilters(filters);
 * // → [{ id: "status", value: ["open"] }, { id: "price", value: [1000, undefined] }]
 *
 * bridge.toSort([{ id: "price", desc: true }]); // → [{ field: "priceCents", dir: "desc" }]
 *
 * bridge.toFilterNode({ filters: [], globalFilter: "ada" });
 * // → { type: "or", nodes: [
 * //     { type: "column", field: "name", filter: { kind: "text", operator: "contains", value: "ada" } },
 * //     { type: "column", field: "sku", filter: { kind: "text", operator: "contains", value: "ada" } },
 * //   ] }
 * ```
 */
export function createTableBridge<
  const C extends TableColumns,
  const G extends readonly string[] = [],
>(input: { columns: C; globalFilter?: TableGlobalFilterOptions<G> }): TableBridge<C, G> {
  const { columns } = input;

  const fieldById = new Map<string, string>();
  const idByField = new Map<string, string>();
  const kinds: Record<string, FieldKind> = {};
  for (const [id, spec] of Object.entries(columns)) {
    const field = spec.field ?? id;
    const other = idByField.get(field);
    if (other !== undefined) {
      throw new Error(`createTableBridge: columns "${other}" and "${id}" both map to "${field}"`);
    }
    fieldById.set(id, field);
    idByField.set(field, id);
    kinds[field] = spec.kind;
  }

  const global = input.globalFilter;
  for (const field of global?.fields ?? []) {
    const kind = kinds[field];
    if (kind !== undefined && kind !== "text") {
      throw new Error(
        `createTableBridge: global filter field "${field}" is a "${kind}" column; it must be text`,
      );
    }
    kinds[field] = "text";
  }

  const globalFilterNode = (value: unknown): FilterNode | null => {
    if (!global || global.fields.length === 0 || !isString(value) || value === "") return null;

    const operator = global.operator ?? "contains";
    const nodes: FilterNode[] = global.fields.map((field) => ({
      type: "column",
      field,
      filter: { kind: "text", operator, value },
    }));

    return nodes.length === 1 ? nodes[0]! : { type: "or", nodes };
  };

  return {
    columns,
    kinds: kinds as InferTableKinds<C, G>,

    toFilters: (columnFilters) => {
      const filters: FiltersRequest = [];
      for (const { id, value } of columnFilters) {
        if (!Object.hasOwn(columns, id)) continue;

        const spec = columns[id]!;
        const filter = spec.toFilter(value);
        if (filter) filters.push({ field: fieldById.get(id)!, filter });
      }

      return filters;
    },

    fromFilters: (filters) => {
      const seen = new Set<string>();
      const columnFilters: TableColumnFiltersState = [];
      for (const { field, filter } of filters) {
        const id = idByField.get(field);
        if (id === undefined || seen.has(id)) continue;

        const spec = columns[id]!;
        if (filter.kind !== spec.kind) continue;

        const value = (spec.fromFilter as (f: FieldFilter) => unknown)(filter);
        if (value === undefined) continue;

        seen.add(id);
        columnFilters.push({ id, value });
      }

      return columnFilters;
    },

    globalFilterNode,

    toFilterNode: ({ filters, globalFilter }) => {
      const nodes: FilterNode[] = filters.map(({ field, filter }) => ({
        type: "column",
        field,
        filter,
      }));
      const search = globalFilterNode(globalFilter);
      if (search) nodes.push(search);

      if (nodes.length === 0) return null;

      return nodes.length === 1 ? nodes[0]! : { type: "and", nodes };
    },

    toSort: (sorting) =>
      sorting.map((s) => ({ field: fieldById.get(s.id) ?? s.id, dir: s.desc ? "desc" : "asc" })),

    fromSort: (sort) =>
      sort.map((s) => ({ id: idByField.get(s.field) ?? s.field, desc: s.dir === "desc" })),
  };
}
