/**
 * Compile-time assertions for `@xtandard/lib/filters/tanstack-table`: the structural table state
 * types match `@tanstack/table-core` v8 AND v9, and the column spec infers value types, field
 * names and kinds. Checked by `tsc --noEmit` (via `bun run check`); not run by the test runner.
 */
import type { Equal, Expect } from "type-testing";
import type {
  ColumnFiltersState as V9ColumnFiltersState,
  PaginationState as V9PaginationState,
  SortingState as V9SortingState,
} from "@tanstack/table-core";
import type {
  ColumnFiltersState as V8ColumnFiltersState,
  PaginationState as V8PaginationState,
  SortingState as V8SortingState,
} from "table-core-v8";

import type { DatePresetValue, NumberRangeValue } from "../src/filters/tanstack-table.ts";
import {
  arrayColumn,
  booleanColumn,
  createTableBridge,
  customColumn,
  dateColumn,
  filterColumn,
  fromPagination,
  fromSort,
  multiSelectColumn,
  numberColumn,
  numberRangeColumn,
  selectColumn,
  tablePaginationOptions,
  textColumn,
  toCursorPagination,
  toPagination,
  toSort,
  type InferTableFilterValues,
  type OperatorValue,
  type TableColumnFiltersState,
  type TablePaginationState,
  type TableSortingState,
} from "../src/filters/tanstack-table.ts";
import type { CursorPagination, OffsetPagination, PagePagination } from "../src/pagination.ts";
import type { FieldFilter, FilterNode, FiltersRequest, Sort } from "../src/filters/types.ts";

// ── the structural state types ARE table-core's, in v8 and v9 ──

type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export type _V9ColumnFilters = Expect<Mutual<TableColumnFiltersState, V9ColumnFiltersState>>;
export type _V9Sorting = Expect<Mutual<TableSortingState, V9SortingState>>;
export type _V9Pagination = Expect<Mutual<TablePaginationState, V9PaginationState>>;
export type _V8ColumnFilters = Expect<Mutual<TableColumnFiltersState, V8ColumnFiltersState>>;
export type _V8Sorting = Expect<Mutual<TableSortingState, V8SortingState>>;
export type _V8Pagination = Expect<Mutual<TablePaginationState, V8PaginationState>>;

// ── a bridge: value types, kinds (with `field` renames + global fields) ──

const bridge = createTableBridge({
  columns: {
    name: textColumn(),
    price: numberRangeColumn({ field: "priceCents" }),
    qty: numberColumn({ operator: "gte" }),
    status: selectColumn(),
    priority: selectColumn({ kind: "number" }),
    labels: multiSelectColumn({ kind: "text" }),
    inStock: booleanColumn(),
    createdAt: dateColumn({ timeZone: "UTC" }),
    tags: arrayColumn(),
    amount: filterColumn({ kind: "number" }),
    rating: customColumn({
      kind: "number",
      toFilter: (value) =>
        typeof value === "number" ? { kind: "number", operator: "gte", value } : null,
      fromFilter: (filter) => (filter.operator === "gte" ? { min: filter.value } : undefined),
    }),
  },
  globalFilter: { fields: ["name", "sku"] },
});

type Values = InferTableFilterValues<typeof bridge.columns>;

export type _Values = Expect<
  Equal<
    Values,
    {
      name: string;
      price: NumberRangeValue;
      qty: number;
      status: string;
      priority: number;
      labels: string[];
      inStock: boolean;
      createdAt: DatePresetValue;
      tags: (string | number)[];
      amount: OperatorValue<"number">;
      rating: { min: number };
    }
  >
>;

export type _Kinds = Expect<
  Equal<
    typeof bridge.kinds,
    {
      name: "text";
      priceCents: "number";
      qty: "number";
      status: "enum";
      priority: "number";
      labels: "text";
      inStock: "boolean";
      createdAt: "date";
      tags: "array";
      amount: "number";
      rating: "number";
      sku: "text";
    }
  >
>;

// operator-shaped values are the filter minus `kind`
export type _OperatorValue = Expect<
  Equal<
    OperatorValue<"boolean">,
    { operator: "eq" | "ne"; value: boolean } | { operator: "isNull" | "isNotNull" }
  >
>;

// `toFilter` narrows to the column's kind
export type _ToFilterKind = Expect<
  Equal<
    ReturnType<typeof bridge.columns.price.toFilter>,
    Extract<FieldFilter, { kind: "number" }> | null
  >
>;

// bound converters speak the model
export type _ToFilters = Expect<Equal<ReturnType<typeof bridge.toFilters>, FiltersRequest>>;
export type _FromFilters = Expect<
  Equal<ReturnType<typeof bridge.fromFilters>, TableColumnFiltersState>
>;
export type _ToFilterNode = Expect<
  Equal<ReturnType<typeof bridge.toFilterNode>, FilterNode | null>
>;
export type _ToSort = Expect<Equal<ReturnType<typeof bridge.toSort>, Sort>>;
export type _FromSort = Expect<Equal<ReturnType<typeof bridge.fromSort>, TableSortingState>>;

// no global filter → kinds come from the columns only
const plain = createTableBridge({ columns: { title: textColumn() } });
export type _PlainKinds = Expect<Equal<typeof plain.kinds, { title: "text" }>>;

// ── spec-free helpers ──

const pagination: TablePaginationState = { pageIndex: 0, pageSize: 10 };

export type _ToSortFree = Expect<Equal<ReturnType<typeof toSort>, { sort: Sort }>>;
export type _FromSortFree = Expect<
  Equal<ReturnType<typeof fromSort>, { sorting: TableSortingState }>
>;

// `style` picks the PaginationInput variant
const page = toPagination({ pagination });
const offset = toPagination({ pagination, style: "offset" });
export type _PageStyle = Expect<Equal<typeof page, { pagination: PagePagination }>>;
export type _OffsetStyle = Expect<Equal<typeof offset, { pagination: OffsetPagination }>>;
export type _FromPagination = Expect<
  Equal<ReturnType<typeof fromPagination>, { pagination: TablePaginationState }>
>;
export type _CursorPagination = Expect<
  Equal<ReturnType<typeof toCursorPagination>, { pagination: CursorPagination; pageIndex: number }>
>;
export type _TablePaginationOptions = Expect<
  Equal<ReturnType<typeof tablePaginationOptions>, { pageCount: number; rowCount?: number }>
>;

// ── outputs plug straight into table-core v9 / v8 state ──

export const _v9ColumnFilters: V9ColumnFiltersState = bridge.fromFilters([]);
export const _v8ColumnFilters: V8ColumnFiltersState = bridge.fromFilters([]);
export const _v9Sorting: V9SortingState = bridge.fromSort([]);
export const _v8Sorting: V8SortingState = fromSort({ sort: [] }).sorting;
export const _v9Pagination: V9PaginationState = fromPagination({
  pagination: { type: "page", page: 1, pageSize: 10 },
}).pagination;

const v9Filters: V9ColumnFiltersState = [];
const v8Sorting: V8SortingState = [];
export const _fromV9 = bridge.toFilters(v9Filters);
export const _fromV8 = bridge.toSort(v8Sorting);
