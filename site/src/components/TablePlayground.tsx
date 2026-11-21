// The TanStack Table playground (playground/table): a server-side (`manual*`) TanStack Table whose
// state lives in this page's URL, answered by an in-browser "server" built on
// @xtandard/lib/filters/memory. The logic lives in table-demo.ts.
import { useEffect, useMemo, useState } from "react";
import {
  columnFilteringFeature,
  createColumnHelper,
  functionalUpdate,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { parseSortParam, serializeSort } from "@xtandard/lib/filters";
import {
  fromPagination,
  rememberCursor,
  tablePaginationOptions,
  toCursorPagination,
  toPagination,
  type NumberRangeValue,
} from "@xtandard/lib/filters/tanstack-table";
import {
  categories,
  listProducts,
  loadSearch,
  productTable,
  readable,
  serializeSearch,
  type Product,
  type ProductSearch,
} from "./table-demo.ts";

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
});
const helper = createColumnHelper<typeof features, Product>();
const columns = helper.columns([
  helper.accessor("name", { header: "Name" }),
  helper.accessor("sku", { header: "SKU", enableSorting: false }),
  helper.accessor("category", { header: "Category" }),
  helper.accessor("priceCents", {
    id: "price", // the column id; the bridge maps it to the model field `priceCents`
    header: "Price",
    cell: (c) => `$${(c.getValue() / 100).toFixed(2)}`,
  }),
  helper.accessor("inStock", {
    header: "In stock",
    enableSorting: false,
    cell: (c) => (c.getValue() ? "yes" : "no"),
  }),
]);

type Mode = "page" | "cursor";
type Panel = "address" | "request" | "model" | "response";
const panels: { key: Panel; label: string }[] = [
  { key: "address", label: "Address bar" },
  { key: "request", label: "Server request" },
  { key: "model", label: "Filter model" },
  { key: "response", label: "Server response" },
];

const pretty = (v: unknown) => JSON.stringify(v, null, 2);
const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** `$12.50` typed by the user ⇄ cents in the filter value. */
const toCents = (dollars: string) =>
  dollars.trim() === "" || Number.isNaN(Number(dollars))
    ? undefined
    : Math.round(Number(dollars) * 100);
const toDollars = (cents: number | undefined) => (cents === undefined ? "" : String(cents / 100));

export default function TablePlayground() {
  // The URL is the source of truth: read it once, write every change back to it.
  const [search, setSearchState] = useState<ProductSearch>(() => loadSearch(window.location.href));
  const [mode, setMode] = useState<Mode>("page");
  const [cursors, setCursors] = useState<readonly string[]>([]);
  const [panel, setPanel] = useState<Panel>("address");

  const setSearch = (patch: Partial<ProductSearch>) => {
    const next = { ...search, ...patch };
    const resetsCursors = (["filters", "q", "sort", "pageSize"] as const).some((k) => k in patch);
    if (resetsCursors) setCursors([]);
    setSearchState(next);
    const { after: _after, ...pageState } = next; // `after` is a request detail, not page state
    window.history.replaceState(
      null,
      "",
      readable(serializeSearch(window.location.pathname, pageState)),
    );
  };

  // URL → table state
  const columnFilters = productTable.fromFilters(search.filters);
  const sorting = productTable.fromSort(parseSortParam({ value: search.sort }).sort);
  const { pagination: wanted } = fromPagination({
    pagination: { type: "page", page: search.page, pageSize: search.pageSize },
  });

  // table state → a request to the in-browser server
  const cursorRequest = toCursorPagination({ pagination: wanted, cursors });
  const pagination =
    mode === "cursor" ? { pageIndex: cursorRequest.pageIndex, pageSize: wanted.pageSize } : wanted;
  const { page: _page, after: _after, ...base } = search;
  const requestUrl =
    mode === "cursor"
      ? serializeSearch("/api/products", {
          ...base,
          after: cursorRequest.pagination.cursor ?? null,
        })
      : serializeSearch("/api/products", { ...base, page: search.page });
  const result = useMemo(() => listProducts(requestUrl, mode), [requestUrl, mode]);

  useEffect(() => {
    if (mode !== "cursor") return;
    // record this page's endCursor so "Next" can be requested
    setCursors((prev) => {
      const next = rememberCursor({
        cursors: prev,
        pageIndex: pagination.pageIndex,
        pageInfo: result.pageInfo,
      }).cursors;
      return sameList(prev, next) ? prev : next;
    });
    // a page the cursors can't reach (a reload on page 4) was clamped: say so in the URL
    if (pagination.pageIndex !== wanted.pageIndex) setSearch({ page: pagination.pageIndex + 1 });
  }, [mode, result, pagination.pageIndex, wanted.pageIndex]);

  const table = useTable({
    features,
    columns,
    data: result.items,
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    ...tablePaginationOptions({ pagination, pageInfo: result.pageInfo }),
    state: { columnFilters, globalFilter: search.q, sorting, pagination },
    // table state → URL (a new filter, search or sort goes back to the first page)
    onColumnFiltersChange: (updater) =>
      setSearch({
        filters: productTable.toFilters(functionalUpdate(updater, columnFilters)),
        page: 1,
      }),
    onGlobalFilterChange: (updater) =>
      setSearch({ q: String(functionalUpdate(updater, search.q) ?? ""), page: 1 }),
    onSortingChange: (updater) =>
      setSearch({
        sort: serializeSort({ sort: productTable.toSort(functionalUpdate(updater, sorting)) }),
        page: 1,
      }),
    onPaginationChange: (updater) => {
      const next = toPagination({ pagination: functionalUpdate(updater, pagination) }).pagination;
      setSearch(
        next.pageSize === search.pageSize
          ? { page: next.page }
          : { page: 1, pageSize: next.pageSize },
      );
    },
  });

  const filterValue = (id: string) => columnFilters.find((f) => f.id === id)?.value;
  const setFilter = (id: string, value: unknown) =>
    table.setColumnFilters((old: ColumnFiltersState) => [
      ...old.filter((f) => f.id !== id),
      ...(value === undefined ? [] : [{ id, value }]),
    ]);

  const name = (filterValue("name") as string | undefined) ?? "";
  const picked = (filterValue("category") as string[] | undefined) ?? [];
  const price = (filterValue("price") as NumberRangeValue | undefined) ?? [undefined, undefined];
  const inStock = filterValue("inStock") as boolean | undefined;

  const model = productTable.toFilterNode({ filters: search.filters, globalFilter: search.q });
  const panelText: Record<Panel, string> = {
    address: readable(serializeSearch(window.location.pathname, { ...base, page: search.page })),
    request: `GET ${readable(requestUrl)}`,
    model: pretty({ columnFilters, sorting, pagination, node: model }),
    response: pretty({ matched: result.matched, pageInfo: result.pageInfo }),
  };

  return (
    <div className="xt-play not-content">
      <div className="xt-row">
        <label>
          Search name or SKU (global filter)
          <input
            value={search.q}
            placeholder="e.g. vinyl"
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </label>
        <label>
          Name contains
          <input value={name} onChange={(e) => setFilter("name", e.target.value || undefined)} />
        </label>
        <label>
          Price from / to ($)
          <span className="xt-pair">
            <input
              inputMode="decimal"
              value={toDollars(price[0])}
              aria-label="Minimum price"
              onChange={(e) => setFilter("price", [toCents(e.target.value), price[1]])}
            />
            <input
              inputMode="decimal"
              value={toDollars(price[1])}
              aria-label="Maximum price"
              onChange={(e) => setFilter("price", [price[0], toCents(e.target.value)])}
            />
          </span>
        </label>
        <label>
          In stock
          <select
            value={inStock === undefined ? "" : String(inStock)}
            onChange={(e) =>
              setFilter("inStock", e.target.value === "" ? undefined : e.target.value === "true")
            }
          >
            <option value="">any</option>
            <option value="true">yes</option>
            <option value="false">no</option>
          </select>
        </label>
      </div>

      <fieldset className="xt-checks">
        <legend>Category</legend>
        {categories.map((c) => (
          <label key={c}>
            <input
              type="checkbox"
              checked={picked.includes(c)}
              onChange={(e) =>
                setFilter(
                  "category",
                  e.target.checked ? [...picked, c] : picked.filter((p) => p !== c),
                )
              }
            />
            {c}
          </label>
        ))}
      </fieldset>

      <div className="xt-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="xt-sort"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? " ▲" : sorted === "desc" ? " ▼" : ""}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {result.items.length === 0 && (
              <tr>
                <td colSpan={columns.length}>No products match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="xt-pager">
        <button
          type="button"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          Previous
        </button>
        <span>
          Page {pagination.pageIndex + 1}
          {mode === "page" ? ` of ${Math.max(1, table.getPageCount())}` : ""} · {result.matched}{" "}
          matching
        </span>
        <button type="button" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
          Next
        </button>
        <label>
          Rows
          <select
            value={search.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[5, 8, 12, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pagination
          <select
            value={mode}
            onChange={(e) => {
              setCursors([]);
              setMode(e.target.value as Mode);
              setSearch({ page: 1 });
            }}
          >
            <option value="page">page (with totals)</option>
            <option value="cursor">cursor</option>
          </select>
        </label>
      </div>

      <div className="xt-tabs" role="group" aria-label="Output">
        {panels.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={panel === p.key}
            onClick={() => setPanel(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <pre>{panelText[panel]}</pre>
    </div>
  );
}
