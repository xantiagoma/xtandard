import { describe, expect, test } from "vitest";
import { decode, encode } from "@effective/rison";

import { compileFilterNode } from "../src/filters/compile.ts";
import { parseSortParam, serializeSort } from "../src/filters/sort.ts";
import type { ColumnFilter, FiltersRequest } from "../src/filters/types.ts";
import { createFilterUrlCodec } from "../src/filters/url.ts";
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
  rememberCursor,
  selectColumn,
  tablePaginationOptions,
  textColumn,
  toCursorPagination,
  toPagination,
  toSort,
  type TableColumnFiltersState,
} from "../src/filters/tanstack-table.ts";

describe("column builders — toFilter", () => {
  test("textColumn: non-empty string → operator (default contains)", () => {
    expect(textColumn().toFilter("ada")).toEqual({
      kind: "text",
      operator: "contains",
      value: "ada",
    });
    expect(textColumn({ operator: "startsWith" }).toFilter("Q3")).toEqual({
      kind: "text",
      operator: "startsWith",
      value: "Q3",
    });
    expect(textColumn().toFilter("  ")).toEqual({
      kind: "text",
      operator: "contains",
      value: "  ",
    });
    for (const empty of ["", undefined, null, 3, ["a"], { value: "a" }]) {
      expect(textColumn().toFilter(empty)).toBeNull();
    }
  });

  test("numberColumn: numbers and numeric strings; junk → null", () => {
    expect(numberColumn({ operator: "gte" }).toFilter("3")).toEqual({
      kind: "number",
      operator: "gte",
      value: 3,
    });
    expect(numberColumn().toFilter(0)).toEqual({ kind: "number", operator: "eq", value: 0 });
    for (const bad of ["abc", "", " ", Number.NaN, Number.POSITIVE_INFINITY, null, true]) {
      expect(numberColumn().toFilter(bad)).toBeNull();
    }
  });

  test("numberRangeColumn: between / gte / lte, open bounds, swapped bounds", () => {
    const price = numberRangeColumn();
    expect(price.toFilter([10, 100])).toEqual({
      kind: "number",
      operator: "between",
      from: 10,
      to: 100,
    });
    expect(price.toFilter(["10", ""])).toEqual({ kind: "number", operator: "gte", value: 10 });
    expect(price.toFilter([undefined, 100])).toEqual({
      kind: "number",
      operator: "lte",
      value: 100,
    });
    expect(price.toFilter([100, 10])).toEqual({
      kind: "number",
      operator: "between",
      from: 10,
      to: 100,
    });
    expect(price.toFilter([0, 0])).toEqual({ kind: "number", operator: "between", from: 0, to: 0 });
    expect(price.toFilter([undefined, undefined])).toBeNull();
    expect(price.toFilter(["", ""])).toBeNull();
    expect(price.toFilter([])).toBeNull();
    expect(price.toFilter(5)).toBeNull();
  });

  test("selectColumn: eq of enum (default), text or number", () => {
    expect(selectColumn().toFilter("open")).toEqual({
      kind: "enum",
      operator: "eq",
      value: "open",
    });
    expect(selectColumn({ kind: "text" }).toFilter("x")).toEqual({
      kind: "text",
      operator: "eq",
      value: "x",
    });
    expect(selectColumn({ kind: "number" }).toFilter("2")).toEqual({
      kind: "number",
      operator: "eq",
      value: 2,
    });
    expect(selectColumn().toFilter("")).toBeNull();
    expect(selectColumn().toFilter(2)).toBeNull();
    expect(selectColumn({ kind: "number" }).toFilter("two")).toBeNull();
  });

  test("multiSelectColumn: inArray/notInArray; bad items skipped; empty → null", () => {
    expect(multiSelectColumn().toFilter(["open", "done"])).toEqual({
      kind: "enum",
      operator: "inArray",
      values: ["open", "done"],
    });
    expect(
      multiSelectColumn({ kind: "number", operator: "notInArray" }).toFilter([1, "2"]),
    ).toEqual({ kind: "number", operator: "notInArray", values: [1, 2] });
    expect(multiSelectColumn().toFilter(["open", 3, "", null])).toEqual({
      kind: "enum",
      operator: "inArray",
      values: ["open"],
    });
    expect(multiSelectColumn().toFilter([])).toBeNull();
    expect(multiSelectColumn().toFilter([3])).toBeNull();
    expect(multiSelectColumn().toFilter("open")).toBeNull();
  });

  test("booleanColumn: only real booleans", () => {
    expect(booleanColumn().toFilter(true)).toEqual({
      kind: "boolean",
      operator: "eq",
      value: true,
    });
    expect(booleanColumn().toFilter(false)).toEqual({
      kind: "boolean",
      operator: "eq",
      value: false,
    });
    for (const bad of ["true", 1, undefined, null])
      expect(booleanColumn().toFilter(bad)).toBeNull();
  });

  test("dateColumn: preset values, default time zone, invalid presets dropped", () => {
    const createdAt = dateColumn({ timeZone: "Europe/Madrid" });
    expect(
      createdAt.toFilter({ operator: "is", unit: "month", anchor: "2026-02-01T00:00:00" }),
    ).toEqual({
      kind: "date",
      operator: "is",
      unit: "month",
      timeZone: "Europe/Madrid",
      anchor: "2026-02-01T00:00:00",
    });
    // an explicit time zone wins over the default; optional args are kept
    expect(
      createdAt.toFilter({
        operator: "between",
        unit: "day",
        timeZone: "UTC",
        anchor: "2026-02-01T00:00:00",
        end: "2026-02-10T00:00:00",
        weekStartsOn: 1,
      }),
    ).toEqual({
      kind: "date",
      operator: "between",
      unit: "day",
      timeZone: "UTC",
      anchor: "2026-02-01T00:00:00",
      end: "2026-02-10T00:00:00",
      weekStartsOn: 1,
    });
    expect(
      createdAt.toFilter({ operator: "is", unit: "fortnight", anchor: "2026-02-01T00:00:00" }),
    ).toBeNull();
    expect(createdAt.toFilter({ operator: "isNull" })).toBeNull(); // presets only
    expect(createdAt.toFilter({ operator: "is", unit: "day" })).toBeNull(); // no anchor
    expect(createdAt.toFilter({ operator: "is", unit: "toString", anchor: "x" })).toBeNull();
    // without a default time zone, the value must carry one
    expect(dateColumn().toFilter({ operator: "is", unit: "day", anchor: "2026-02-01" })).toBeNull();
  });

  test("arrayColumn: arrayOverlaps by default, arrayContains on request", () => {
    expect(arrayColumn().toFilter(["a", "b"])).toEqual({
      kind: "array",
      operator: "arrayOverlaps",
      values: ["a", "b"],
    });
    expect(arrayColumn({ operator: "arrayContains" }).toFilter(["a", 1, "", null])).toEqual({
      kind: "array",
      operator: "arrayContains",
      values: ["a", 1],
    });
    expect(arrayColumn().toFilter([])).toBeNull();
  });

  test("filterColumn: any operator of the kind, checked like a URL leaf", () => {
    const amount = filterColumn({ kind: "number" });
    expect(amount.toFilter({ operator: "notBetween", from: 1, to: 9 })).toEqual({
      kind: "number",
      operator: "notBetween",
      from: 1,
      to: 9,
    });
    expect(amount.toFilter({ operator: "inArray", values: [1, 2] })).toEqual({
      kind: "number",
      operator: "inArray",
      values: [1, 2],
    });
    expect(amount.toFilter({ operator: "isNull" })).toEqual({ kind: "number", operator: "isNull" });
    expect(amount.toFilter({ operator: "gte", value: "3" })).toBeNull();
    expect(amount.toFilter({ operator: "contains", value: "3" })).toBeNull(); // not a number op
    expect(amount.toFilter({ operator: "toString" })).toBeNull();
    expect(amount.toFilter({ operator: "inArray", values: [1, "2"] })).toBeNull();
    expect(amount.toFilter(null)).toBeNull();

    const name = filterColumn({ kind: "text" });
    expect(name.toFilter({ operator: "ilike", value: "a%" })).toEqual({
      kind: "text",
      operator: "ilike",
      value: "a%",
    });
  });

  test("customColumn: your mapping, as given", () => {
    const rating = customColumn({
      kind: "number",
      toFilter: (value) =>
        typeof value === "number" && value > 0 ? { kind: "number", operator: "gte", value } : null,
      fromFilter: (filter) => (filter.operator === "gte" ? filter.value : undefined),
    });
    expect(rating.toFilter(4)).toEqual({ kind: "number", operator: "gte", value: 4 });
    expect(rating.toFilter(0)).toBeNull();
    expect(rating.fromFilter({ kind: "number", operator: "gte", value: 4 })).toBe(4);
    expect(rating.fromFilter({ kind: "number", operator: "lt", value: 4 })).toBeUndefined();
  });
});

describe("column builders — round trip", () => {
  // value → filter → value is the identity on normalized values, and
  // filter → value → filter is the identity on every filter a column produces.
  const cases = [
    { spec: textColumn(), values: ["ada", "a%_b"] },
    { spec: textColumn({ operator: "eq" }), values: ["exact"] },
    { spec: numberColumn({ operator: "lt" }), values: [0, -2.5, 1e9] },
    {
      spec: numberRangeColumn(),
      values: [
        [1, 2],
        [1, undefined],
        [undefined, 2],
        [3, 3],
      ],
    },
    { spec: selectColumn(), values: ["open"] },
    { spec: selectColumn({ kind: "number" }), values: [7] },
    { spec: multiSelectColumn({ kind: "text" }), values: [["a"], ["a", "b", "a"]] },
    { spec: multiSelectColumn({ operator: "notInArray" }), values: [["x"]] },
    { spec: booleanColumn(), values: [true, false] },
    {
      spec: dateColumn({ timeZone: "UTC" }),
      values: [
        { operator: "is", unit: "week", anchor: "2026-02-01T00:00:00", weekStartsOn: 1 },
        { operator: "before", unit: "day", anchor: "2026-02-01T00:00:00", timeZone: "Asia/Tokyo" },
        {
          operator: "between",
          unit: "day",
          anchor: "2026-02-01T00:00:00",
          end: "2026-03-01T00:00:00",
        },
      ],
    },
    {
      spec: dateColumn(),
      values: [{ operator: "after", unit: "year", anchor: "2026-01-01T00:00:00", timeZone: "UTC" }],
    },
    { spec: arrayColumn(), values: [["a", 1]] },
    { spec: arrayColumn({ operator: "arrayContained" }), values: [["a"]] },
    {
      spec: filterColumn({ kind: "text" }),
      values: [
        { operator: "notIlike", value: "x" },
        { operator: "notInArray", values: ["a"] },
        { operator: "isNotNull" },
      ],
    },
    {
      spec: filterColumn({ kind: "date" }),
      values: [
        { operator: "is", unit: "quarter", timeZone: "UTC", anchor: "2026-01-01T00:00:00" },
        { operator: "isNull" },
      ],
    },
    {
      spec: filterColumn({ kind: "array" }),
      values: [{ operator: "arrayContains", values: ["a", 2] }],
    },
  ] as const;

  for (const { spec, values } of cases) {
    for (const value of values) {
      test(`${spec.kind}: ${JSON.stringify(value)}`, () => {
        const filter = spec.toFilter(value);
        expect(filter).not.toBeNull();
        const back = (spec.fromFilter as (f: unknown) => unknown)(filter);
        expect(back).toEqual(value);
        expect(spec.toFilter(back)).toEqual(filter);
      });
    }
  }

  test("normalizing values round-trip to their normal form", () => {
    const price = numberRangeColumn();
    const filter = price.toFilter(["100", "10"]);
    expect(price.fromFilter(filter!)).toEqual([10, 100]);
  });

  test("fromFilter returns undefined for a filter the column can't show", () => {
    expect(textColumn().fromFilter({ kind: "text", operator: "startsWith", value: "a" })).toBe(
      undefined,
    );
    expect(numberRangeColumn().fromFilter({ kind: "number", operator: "gt", value: 1 })).toBe(
      undefined,
    );
    expect(selectColumn().fromFilter({ kind: "enum", operator: "ne", value: "a" })).toBe(undefined);
    expect(multiSelectColumn().fromFilter({ kind: "enum", operator: "eq", value: "a" })).toBe(
      undefined,
    );
    expect(booleanColumn().fromFilter({ kind: "boolean", operator: "isNull" })).toBe(undefined);
    expect(dateColumn().fromFilter({ kind: "date", operator: "isNull" })).toBe(undefined);
    expect(
      arrayColumn().fromFilter({ kind: "array", operator: "arrayContains", values: ["a"] }),
    ).toBe(undefined);
  });
});

describe("createTableBridge", () => {
  const bridge = createTableBridge({
    columns: {
      name: textColumn(),
      status: multiSelectColumn(),
      price: numberRangeColumn({ field: "priceCents" }),
      inStock: booleanColumn(),
    },
    globalFilter: { fields: ["name", "sku"] },
  });

  test("kinds: column fields (renamed) + global fields as text", () => {
    expect(bridge.kinds).toEqual({
      name: "text",
      status: "enum",
      priceCents: "number",
      inStock: "boolean",
      sku: "text",
    });
  });

  test("toFilters: maps ids to fields; unknown ids and empty values dropped", () => {
    const columnFilters: TableColumnFiltersState = [
      { id: "status", value: ["open"] },
      { id: "price", value: [1000, undefined] },
      { id: "nope", value: "x" },
      { id: "toString", value: "x" },
      { id: "name", value: "" },
      { id: "inStock", value: false },
    ];
    expect(bridge.toFilters(columnFilters)).toEqual([
      { field: "status", filter: { kind: "enum", operator: "inArray", values: ["open"] } },
      { field: "priceCents", filter: { kind: "number", operator: "gte", value: 1000 } },
      { field: "inStock", filter: { kind: "boolean", operator: "eq", value: false } },
    ]);
  });

  test("fromFilters: maps fields back; mismatched kind, unknown field, unrepresentable, duplicates dropped", () => {
    const filters: FiltersRequest = [
      { field: "priceCents", filter: { kind: "number", operator: "between", from: 1, to: 2 } },
      { field: "priceCents", filter: { kind: "number", operator: "gte", value: 5 } }, // dup → first wins
      { field: "price", filter: { kind: "number", operator: "gte", value: 5 } }, // column id, not field
      { field: "status", filter: { kind: "text", operator: "eq", value: "open" } }, // wrong kind
      { field: "name", filter: { kind: "text", operator: "endsWith", value: "x" } }, // not contains
      { field: "sku", filter: { kind: "text", operator: "contains", value: "x" } }, // global only
      { field: "name", filter: { kind: "text", operator: "contains", value: "ada" } },
    ];
    expect(bridge.fromFilters(filters)).toEqual([
      { id: "price", value: [1, 2] },
      { id: "name", value: "ada" },
    ]);
  });

  test("toFilters ∘ fromFilters is the identity on the image", () => {
    const filters: FiltersRequest = [
      { field: "name", filter: { kind: "text", operator: "contains", value: "ada" } },
      { field: "status", filter: { kind: "enum", operator: "inArray", values: ["a", "b"] } },
      { field: "priceCents", filter: { kind: "number", operator: "lte", value: 9 } },
      { field: "inStock", filter: { kind: "boolean", operator: "eq", value: true } },
    ];
    expect(bridge.toFilters(bridge.fromFilters(filters))).toEqual(filters);
  });

  test("globalFilterNode / toFilterNode", () => {
    expect(bridge.globalFilterNode("")).toBeNull();
    expect(bridge.globalFilterNode(undefined)).toBeNull();
    expect(bridge.globalFilterNode(42)).toBeNull();

    const search = {
      type: "or",
      nodes: [
        {
          type: "column",
          field: "name",
          filter: { kind: "text", operator: "contains", value: "ada" },
        },
        {
          type: "column",
          field: "sku",
          filter: { kind: "text", operator: "contains", value: "ada" },
        },
      ],
    };
    expect(bridge.toFilterNode({ filters: [], globalFilter: "ada" })).toEqual(search);
    expect(bridge.toFilterNode({ filters: [] })).toBeNull();

    const inStock: ColumnFilter = {
      field: "inStock",
      filter: { kind: "boolean", operator: "eq", value: true },
    };
    expect(bridge.toFilterNode({ filters: [inStock] })).toEqual({ type: "column", ...inStock });
    expect(bridge.toFilterNode({ filters: [inStock], globalFilter: "ada" })).toEqual({
      type: "and",
      nodes: [{ type: "column", ...inStock }, search],
    });
  });

  test("a single global field is a plain column node; operator is configurable", () => {
    const one = createTableBridge({
      columns: {},
      globalFilter: { fields: ["title"], operator: "startsWith" },
    });
    expect(one.globalFilterNode("Q3")).toEqual({
      type: "column",
      field: "title",
      filter: { kind: "text", operator: "startsWith", value: "Q3" },
    });
    expect(createTableBridge({ columns: {} }).globalFilterNode("x")).toBeNull();
  });

  test("toSort / fromSort map ids ⇄ fields; other ids pass through", () => {
    expect(
      bridge.toSort([
        { id: "price", desc: true },
        { id: "createdAt", desc: false },
      ]),
    ).toEqual([
      { field: "priceCents", dir: "desc" },
      { field: "createdAt", dir: "asc" },
    ]);
    expect(
      bridge.fromSort([
        { field: "priceCents", dir: "asc" },
        { field: "createdAt", dir: "desc" },
      ]),
    ).toEqual([
      { id: "price", desc: false },
      { id: "createdAt", desc: true },
    ]);
  });

  test("throws on two columns mapping to one field, or a non-text global field", () => {
    expect(() =>
      createTableBridge({
        columns: { a: textColumn({ field: "x" }), x: textColumn() },
      }),
    ).toThrow('columns "a" and "x" both map to "x"');
    expect(() =>
      createTableBridge({
        columns: { status: selectColumn() },
        globalFilter: { fields: ["status"] },
      }),
    ).toThrow('global filter field "status" is a "enum" column');
  });
});

describe("sorting", () => {
  test("toSort / fromSort", () => {
    expect(
      toSort({
        sorting: [
          { id: "price", desc: true },
          { id: "name", desc: false },
        ],
      }),
    ).toEqual({
      sort: [
        { field: "price", dir: "desc" },
        { field: "name", dir: "asc" },
      ],
    });
    expect(fromSort(parseSortParam({ value: "price:desc" }))).toEqual({
      sorting: [{ id: "price", desc: true }],
    });
    expect(toSort({ sorting: [] })).toEqual({ sort: [] });
  });

  test("round-trips through the URL sort param", () => {
    const sorting = [
      { id: "price", desc: false },
      { id: "name", desc: true },
    ];
    const param = serializeSort(toSort({ sorting }));
    expect(param).toBe("price:asc,name:desc");
    expect(fromSort(parseSortParam({ value: param })).sorting).toEqual(sorting);
  });
});

describe("pagination", () => {
  test("toPagination: page (1-based) or offset", () => {
    expect(toPagination({ pagination: { pageIndex: 2, pageSize: 20 } })).toEqual({
      pagination: { type: "page", page: 3, pageSize: 20 },
    });
    expect(toPagination({ pagination: { pageIndex: 2, pageSize: 20 }, style: "offset" })).toEqual({
      pagination: { type: "offset", limit: 20, offset: 40 },
    });
    // clamped like toOffsetWindow
    expect(toPagination({ pagination: { pageIndex: -1, pageSize: 0 } })).toEqual({
      pagination: { type: "page", page: 1, pageSize: 1 },
    });
  });

  test("fromPagination: page and offset", () => {
    expect(fromPagination({ pagination: { type: "page", page: 3, pageSize: 20 } })).toEqual({
      pagination: { pageIndex: 2, pageSize: 20 },
    });
    expect(fromPagination({ pagination: { type: "offset", limit: 20, offset: 45 } })).toEqual({
      pagination: { pageIndex: 2, pageSize: 20 },
    });
    expect(fromPagination({ pagination: { type: "page", page: 0, pageSize: 0 } })).toEqual({
      pagination: { pageIndex: 0, pageSize: 1 },
    });
    for (const pagination of [
      { pageIndex: 0, pageSize: 10 },
      { pageIndex: 7, pageSize: 25 },
    ]) {
      expect(fromPagination(toPagination({ pagination })).pagination).toEqual(pagination);
      expect(fromPagination(toPagination({ pagination, style: "offset" })).pagination).toEqual(
        pagination,
      );
    }
  });

  test("tablePaginationOptions: exact with a total, +1 page while hasNextPage without", () => {
    const pagination = { pageIndex: 0, pageSize: 20 };
    expect(
      tablePaginationOptions({
        pagination,
        pageInfo: { hasNextPage: true, hasPreviousPage: false, totalItems: 45 },
      }),
    ).toEqual({ pageCount: 3, rowCount: 45 });
    expect(
      tablePaginationOptions({
        pagination,
        pageInfo: { hasNextPage: true, hasPreviousPage: false, totalItems: 45, totalPages: 3 },
      }),
    ).toEqual({ pageCount: 3, rowCount: 45 });
    expect(
      tablePaginationOptions({
        pagination,
        pageInfo: { hasNextPage: true, hasPreviousPage: false },
      }),
    ).toEqual({ pageCount: 2 });
    expect(
      tablePaginationOptions({
        pagination: { pageIndex: 4, pageSize: 20 },
        pageInfo: { hasNextPage: false, hasPreviousPage: true },
      }),
    ).toEqual({ pageCount: 5 });
    expect(tablePaginationOptions({ pagination, pageInfo: undefined })).toEqual({ pageCount: 1 });
  });

  test("toCursorPagination: the cursor stack, clamped to known pages", () => {
    expect(toCursorPagination({ pagination: { pageIndex: 0, pageSize: 20 }, cursors: [] })).toEqual(
      {
        pagination: { type: "cursor", limit: 20, cursor: null, direction: "forward" },
        pageIndex: 0,
      },
    );
    expect(
      toCursorPagination({ pagination: { pageIndex: 2, pageSize: 20 }, cursors: ["c1", "c2"] }),
    ).toEqual({
      pagination: { type: "cursor", limit: 20, cursor: "c2", direction: "forward" },
      pageIndex: 2,
    });
    expect(
      toCursorPagination({ pagination: { pageIndex: 5, pageSize: 20 }, cursors: ["c1"] }),
    ).toEqual({
      pagination: { type: "cursor", limit: 20, cursor: "c1", direction: "forward" },
      pageIndex: 1,
    });
  });

  test("rememberCursor: records endCursor, drops a stale tail, stops at the last page", () => {
    expect(
      rememberCursor({
        cursors: [],
        pageIndex: 0,
        pageInfo: { hasNextPage: true, hasPreviousPage: false, endCursor: "c1" },
      }),
    ).toEqual({ cursors: ["c1"] });
    expect(
      rememberCursor({
        cursors: ["c1", "c2"],
        pageIndex: 1,
        pageInfo: { hasNextPage: false, hasPreviousPage: true, endCursor: "x" },
      }),
    ).toEqual({ cursors: ["c1"] });
    expect(
      rememberCursor({
        cursors: ["c1", "old2", "old3"],
        pageIndex: 1,
        pageInfo: { hasNextPage: true, hasPreviousPage: true, endCursor: "c2" },
      }),
    ).toEqual({ cursors: ["c1", "c2"] });
    expect(
      rememberCursor({
        cursors: ["c1"],
        pageIndex: 1,
        pageInfo: { hasNextPage: true, hasPreviousPage: true, endCursor: null },
      }),
    ).toEqual({ cursors: ["c1"] });
  });

  test("walking a cursor-paginated source page by page", () => {
    const rows = Array.from({ length: 7 }, (_, i) => i + 1);
    // a tiny keyset "server": cursor = last id seen
    const fetchPage = (cursor: string | null | undefined, limit: number) => {
      const start = cursor ? rows.indexOf(Number(cursor)) + 1 : 0;
      const items = rows.slice(start, start + limit);
      const hasNextPage = start + limit < rows.length;
      return {
        items,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: start > 0,
          endCursor: items.length > 0 ? String(items.at(-1)) : null,
        },
      };
    };

    let cursors: readonly string[] = [];
    const seen: number[][] = [];
    for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
      const req = toCursorPagination({ pagination: { pageIndex, pageSize: 3 }, cursors });
      expect(req.pageIndex).toBe(Math.min(pageIndex, 2));
      const page = fetchPage(req.pagination.cursor, req.pagination.limit);
      if (req.pageIndex !== pageIndex) break; // the table would be told to go back
      seen.push(page.items);
      cursors = rememberCursor({ cursors, pageIndex, pageInfo: page.pageInfo }).cursors;
      expect(
        tablePaginationOptions({
          pagination: { pageIndex, pageSize: 3 },
          pageInfo: page.pageInfo,
        }).pageCount,
      ).toBe(page.pageInfo.hasNextPage ? pageIndex + 2 : pageIndex + 1);
    }
    expect(seen).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    // going back to page 1 reuses the remembered cursor
    const back = toCursorPagination({ pagination: { pageIndex: 1, pageSize: 3 }, cursors });
    expect(fetchPage(back.pagination.cursor, 3).items).toEqual([4, 5, 6]);
  });
});

describe("table → URL → server → table", () => {
  const bridge = createTableBridge({
    columns: {
      name: textColumn(),
      status: multiSelectColumn(),
      price: numberRangeColumn({ field: "priceCents" }),
      createdAt: dateColumn({ timeZone: "UTC" }),
    },
    globalFilter: { fields: ["name"] },
  });
  const urlCodec = createFilterUrlCodec({ kinds: bridge.kinds });

  test("column filters survive the compact Rison URL and compile on the server", () => {
    const columnFilters: TableColumnFiltersState = [
      { id: "status", value: ["open", "doing"] },
      { id: "price", value: ["1000", "5000"] },
      {
        id: "createdAt",
        value: { operator: "is", unit: "month", anchor: "2026-02-01T00:00:00" },
      },
    ];

    // browser: table state → model → compact → Rison query param
    const param = encode(urlCodec.encodeFilters(bridge.toFilters(columnFilters)));
    expect(param).toBe(
      "!((f:status,o:iA,vs:!(open,doing)),(f:priceCents,fr:1000,o:bt,to:5000),(a:'2026-02-01T00:00:00',f:createdAt,o:is,tz:UTC,u:mo))",
    );

    // server: param → model (allow-listed by kinds) → FilterNode → CompiledWhere
    const filters = urlCodec.decodeFilters(decode(param));
    const node = bridge.toFilterNode({ filters, globalFilter: "ada" });
    const { where } = compileFilterNode({
      spec: bridge.kinds,
      node: node!,
      resolveDate: () => ({
        start: new Date("2026-02-01T00:00:00Z"),
        end: new Date("2026-03-01T00:00:00Z"),
      }),
    });
    expect(where).toEqual({
      type: "and",
      nodes: [
        { type: "cond", cond: { field: "status", op: "inArray", values: ["open", "doing"] } },
        {
          type: "and",
          nodes: [
            { type: "cond", cond: { field: "priceCents", op: "gte", value: 1000 } },
            { type: "cond", cond: { field: "priceCents", op: "lte", value: 5000 } },
          ],
        },
        {
          type: "and",
          nodes: [
            {
              type: "cond",
              cond: { field: "createdAt", op: "gte", value: new Date("2026-02-01T00:00:00Z") },
            },
            {
              type: "cond",
              cond: { field: "createdAt", op: "lt", value: new Date("2026-03-01T00:00:00Z") },
            },
          ],
        },
        { type: "cond", cond: { field: "name", op: "contains", value: "ada" } },
      ],
    });

    // browser again: the URL restores the table state (normalized: "1000" → 1000)
    expect(bridge.fromFilters(filters)).toEqual([
      { id: "status", value: ["open", "doing"] },
      { id: "price", value: [1000, 5000] },
      {
        id: "createdAt",
        value: { operator: "is", unit: "month", anchor: "2026-02-01T00:00:00" },
      },
    ]);
  });
});
