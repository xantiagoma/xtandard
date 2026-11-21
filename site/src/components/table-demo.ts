// The TanStack Table playground's logic, kept free of React so it can be run with plain bun:
// a "products" dataset, the shared column spec and URL format (what browser and server both
// import), and `listProducts`, the in-browser "server" built on @xtandard/lib/filters/memory.
import { decode, encode } from "@effective/rison";
import {
  createFilterUrlCodec,
  parseSortParam,
  type FiltersRequest,
  type Paginated,
} from "@xtandard/lib/filters";
import {
  booleanField,
  buildFilterNodePredicate,
  createMemoryPaginator,
  enumField,
  numberField,
  textField,
} from "@xtandard/lib/filters/memory";
import {
  booleanColumn,
  createTableBridge,
  multiSelectColumn,
  numberRangeColumn,
  textColumn,
} from "@xtandard/lib/filters/tanstack-table";
import {
  createLoader,
  createSerializer,
  parseAsCodec,
  parseAsInteger,
  parseAsString,
  type ValueCodec,
} from "@xtandard/lib/tanstack/server";

// ── the data (the "database") ──────────────────────────────────────────────

export type Product = {
  id: number;
  name: string;
  sku: string;
  category: "books" | "games" | "music";
  priceCents: number;
  inStock: boolean;
};

const adjectives = ["Red", "Quiet", "Giant", "Tiny", "Golden", "Lost", "Rapid", "Hidden"];
const nouns = { books: "Atlas", games: "Board Game", music: "Vinyl" } as const;
export const categories = ["books", "games", "music"] as const;

export const products: Product[] = Array.from({ length: 48 }, (_, i) => {
  const category = categories[i % 3]!;
  return {
    id: i + 1,
    name: `${adjectives[(i * 5) % adjectives.length]} ${nouns[category]} ${Math.floor(i / 3) + 1}`,
    sku: `SKU-${String(1000 + ((i * 37) % 900)).padStart(4, "0")}`,
    category,
    priceCents: 500 + ((i * 731) % 9500),
    inStock: i % 4 !== 0,
  };
});

// ── shared by browser and server: the column spec and the URL format ───────

export const productTable = createTableBridge({
  columns: {
    name: textColumn(),
    category: multiSelectColumn(),
    price: numberRangeColumn({ field: "priceCents" }),
    inStock: booleanColumn(),
  },
  globalFilter: { fields: ["name", "sku"] },
});

const urlCodec = createFilterUrlCodec({ kinds: productTable.kinds });
const filtersCodec: ValueCodec<FiltersRequest> = {
  encode: (filters) => encode(urlCodec.encodeFilters(filters)),
  decode: (token) => urlCodec.decodeFilters(decode(token)),
};

export const productSearch = {
  filters: parseAsCodec(filtersCodec).withDefault([]),
  q: parseAsString.withDefault(""),
  sort: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(8),
  after: parseAsString, // cursor mode only: the request's `after` cursor
};

export type ProductSearch = ReturnType<ReturnType<typeof createLoader<typeof productSearch>>>;

/** Builds `/api/products?…` (or the page's own query) from the search state; defaults are left out. */
export const serializeSearch = createSerializer(productSearch);
export const loadSearch = createLoader(productSearch);

/** The URL with Rison's `( ) , : ! '` readable, as `keepSubDelims` leaves them in the address bar. */
export function readable(url: string): string {
  return url.replace(/%2[89cC1]|%3[aA]|%21|%27/g, (m) => decodeURIComponent(m));
}

// ── the server ──────────────────────────────────────────────────────────────

// The server-side allow-lists, keyed by the same model fields as `productTable.kinds`.
const spec = {
  name: textField({ path: "name" }),
  sku: textField({ path: "sku" }),
  category: enumField({ path: "category" }),
  priceCents: numberField({ path: "priceCents" }),
  inStock: booleanField({ path: "inStock" }),
};
const sortable = new Set(["name", "category", "priceCents"]);

export type ServerResult = Paginated<Product> & { matched: number };

/** `GET /api/products`: decode the URL, filter, sort and paginate, all in memory. */
export function listProducts(url: string, mode: "page" | "cursor"): ServerResult {
  const search = loadSearch(url);

  const node = productTable.toFilterNode({ filters: search.filters, globalFilter: search.q });
  const rows = node
    ? products.filter(buildFilterNodePredicate({ spec, node }).predicate)
    : products;

  const { sort } = parseSortParam({ value: search.sort });
  const allowed = sort.filter((s) => sortable.has(s.field));
  const paginator = createMemoryPaginator({
    rows,
    sort: [...allowed.map((s) => ({ key: s.field, order: s.dir })), { key: "id", order: "asc" }],
  });

  const pageSize = Math.min(Math.max(1, search.pageSize), 50);
  const result =
    mode === "cursor"
      ? paginator.paginate({ type: "cursor", limit: pageSize, cursor: search.after })
      : paginator.paginate({ type: "page", page: search.page, pageSize });

  return { ...result, matched: rows.length };
}
