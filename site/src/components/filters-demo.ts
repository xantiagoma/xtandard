// The filters playground's logic, kept free of React so it can be run and tested with plain bun:
// one example resource ("products"), its spec for every adapter that needs no driver, a small
// date resolver, and `renderAll`, which turns the editor's JSON into every output the page shows.
import { Temporal } from "@js-temporal/polyfill";
import {
  compactFilterNode,
  compactFilters,
  compileFilterNode,
  compileFilters,
  describeColumnFilter,
  type ColumnFilter,
  type DatePreset,
  type FieldKind,
  type FilterNode,
  type SqlDialect,
} from "@xtandard/lib/filters";
import * as knex from "@xtandard/lib/filters/knex";
import * as mongo from "@xtandard/lib/filters/mongo";
import * as prisma from "@xtandard/lib/filters/prisma";
import * as postgrest from "@xtandard/lib/filters/postgrest";
import * as elasticsearch from "@xtandard/lib/filters/elasticsearch";

export const kinds = {
  name: "text",
  status: "enum",
  price: "number",
  inStock: "boolean",
  tags: "array",
  createdAt: "date",
} satisfies Record<string, FieldKind>;

export const labels: Record<keyof typeof kinds, string> = {
  name: "Name",
  status: "Status",
  price: "Price",
  inStock: "In stock",
  tags: "Tags",
  createdAt: "Created",
};

const knexSpec = {
  name: knex.textField({ column: "products.name" }),
  status: knex.enumField({ column: "products.status" }),
  price: knex.numberField({ column: "products.price" }),
  inStock: knex.booleanField({ column: "products.in_stock" }),
  tags: knex.arrayField({ column: "products.tags" }),
  createdAt: knex.dateField({ column: "products.created_at" }),
};
const mongoSpec = {
  name: mongo.textField({ path: "name" }),
  status: mongo.enumField({ path: "status" }),
  price: mongo.numberField({ path: "price" }),
  inStock: mongo.booleanField({ path: "inStock" }),
  tags: mongo.arrayField({ path: "tags" }),
  createdAt: mongo.dateField({ path: "createdAt" }),
};
const prismaSpec = {
  name: prisma.textField({ field: "name" }),
  status: prisma.enumField({ field: "status" }),
  price: prisma.numberField({ field: "price" }),
  inStock: prisma.booleanField({ field: "inStock" }),
  tags: prisma.arrayField({ field: "tags" }),
  createdAt: prisma.dateField({ field: "createdAt" }),
};
const postgrestSpec = {
  name: postgrest.textField({ column: "name" }),
  status: postgrest.enumField({ column: "status" }),
  price: postgrest.numberField({ column: "price" }),
  inStock: postgrest.booleanField({ column: "in_stock" }),
  tags: postgrest.arrayField({ column: "tags" }),
  createdAt: postgrest.dateField({ column: "created_at" }),
};
const elasticsearchSpec = {
  name: elasticsearch.textField({ field: "name.keyword" }),
  status: elasticsearch.enumField({ field: "status" }),
  price: elasticsearch.numberField({ field: "price" }),
  inStock: elasticsearch.booleanField({ field: "inStock" }),
  tags: elasticsearch.arrayField({ field: "tags" }),
  createdAt: elasticsearch.dateField({ field: "createdAt" }),
};

/**
 * A small DST-aware resolver for the demo: `is` → the whole period containing `anchor` in
 * `timeZone`; `before` → everything before that period; `after` → everything after it;
 * `between` → [anchor, end). Real apps inject their own (see "The date kind is injected").
 */
export function resolveDate({ value }: { value: DatePreset }): {
  start: Date | null;
  end: Date | null;
} {
  const zoned = (s: string) => Temporal.PlainDateTime.from(s).toZonedDateTime(value.timeZone);
  const toDate = (z: Temporal.ZonedDateTime) => new Date(z.epochMilliseconds);
  if (value.operator === "between") {
    return { start: toDate(zoned(value.anchor)), end: value.end ? toDate(zoned(value.end)) : null };
  }
  const anchor = zoned(value.anchor);
  let start: Temporal.ZonedDateTime;
  switch (value.unit) {
    case "year":
      start = anchor.with({ month: 1, day: 1 }).startOfDay();
      break;
    case "quarter" as string:
      start = anchor
        .with({ month: Math.floor((anchor.month - 1) / 3) * 3 + 1, day: 1 })
        .startOfDay();
      break;
    case "month":
      start = anchor.with({ day: 1 }).startOfDay();
      break;
    case "week": {
      const first = value.weekStartsOn ?? 1; // ISO: Monday
      start = anchor.subtract({ days: (anchor.dayOfWeek - first + 7) % 7 }).startOfDay();
      break;
    }
    case "day":
      start = anchor.startOfDay();
      break;
    default:
      start = anchor.round({ smallestUnit: value.unit as "hour", roundingMode: "floor" });
  }
  const end =
    value.unit === ("quarter" as string)
      ? start.add({ months: 3 })
      : start.add({ [`${value.unit}s`]: 1 });
  if (value.operator === "before") return { start: null, end: toDate(start) };
  if (value.operator === "after") return { start: toDate(end), end: null };
  return { start: toDate(start), end: toDate(end) };
}

/** The demo's chip label for a date preset (real apps inject a localized one). */
function describeDate(f: DatePreset): string {
  const day = f.anchor.slice(0, 10);
  if (f.operator === "between") return `between ${day} and ${(f.end ?? "").slice(0, 10)}`;
  return `${f.operator === "is" ? "in the" : f.operator} ${f.unit} of ${day} (${f.timeZone})`;
}

export type Output = { ok: true; value: string } | { ok: false; error: string };
export type Rendered = {
  input: "list" | "tree";
  ast: Output;
  sql: Output;
  mongo: Output;
  prisma: Output;
  postgrest: Output;
  elasticsearch: Output;
  url: Output;
  labels: Output;
};

const json = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (x instanceof Date ? x.toISOString() : x), 2);
const attempt = (fn: () => string): Output => {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

/** Inlines `?` bindings into the SQL, for reading only (the real output stays parameterized). */
const inline = (sql: string, bindings: unknown[]) => {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const b = bindings[i++];
    if (b instanceof Date) return `'${b.toISOString()}'`;
    if (typeof b === "string") return `'${b.replaceAll("'", "''")}'`;
    if (Array.isArray(b))
      return `ARRAY[${b.map((x) => (typeof x === "string" ? `'${x}'` : String(x))).join(", ")}]`;
    return String(b);
  });
};

/** Everything the playground shows, from the editor's text. Throws only on invalid JSON. */
export function renderAll(text: string, dialect: SqlDialect): Rendered {
  const parsed: unknown = JSON.parse(text);
  const isList = Array.isArray(parsed);
  const filters = parsed as ColumnFilter[];
  const node = parsed as FilterNode;
  if (!isList && (typeof parsed !== "object" || parsed === null || !("type" in parsed))) {
    throw new Error(
      'Expected a filter list ([{ field, filter }, …]) or a FilterNode ({ type: "and" | "or" | "not" | "column", … }).',
    );
  }

  const ast = attempt(() => {
    const { where } = isList
      ? compileFilters({ spec: kinds, filters, resolveDate })
      : compileFilterNode({ spec: kinds, node, resolveDate });
    return json(where);
  });
  const sql = attempt(() => {
    const frag = isList
      ? knex.buildWhereSql({ spec: knexSpec, filters, resolveDate, dialect })
      : knex.buildFilterNodeSql({ spec: knexSpec, node, resolveDate, dialect });
    if (!frag) return "-- no conditions (everything was dropped or the request is empty)";
    return `-- parameterized\nWHERE ${frag.sql}\n-- bindings: ${json(frag.bindings).replace(/\s+/g, " ")}\n\n-- inlined for reading\nWHERE ${inline(frag.sql, frag.bindings)}`;
  });
  const mongoOut = attempt(() => {
    const out = isList
      ? mongo.buildFilter({ spec: mongoSpec, filters, resolveDate })
      : mongo.buildFilterNode({ spec: mongoSpec, node, resolveDate });
    return `collection.find(${json(out.filter ?? {})})`;
  });
  const prismaOut = attempt(() => {
    const out = isList
      ? prisma.buildWhere({ spec: prismaSpec, filters, resolveDate })
      : prisma.buildFilterNode({ spec: prismaSpec, node, resolveDate });
    return `prisma.product.findMany({ where: ${json(out.where ?? {})} })`;
  });
  const postgrestOut = attempt(() => {
    const { params } = isList
      ? postgrest.buildParams({ spec: postgrestSpec, filters, resolveDate })
      : postgrest.buildFilterNode({ spec: postgrestSpec, node, resolveDate });
    if (params.length === 0)
      return "// no conditions (everything was dropped or the request is empty)";
    const lines = params.map(([k, v]) => `${k}=${v}`).join("\n");
    return `GET /products?${new URLSearchParams(params)}\n\n// params, unencoded\n${lines}`;
  });
  const elasticsearchOut = attempt(() => {
    const { query } = isList
      ? elasticsearch.buildQuery({ spec: elasticsearchSpec, filters, resolveDate })
      : elasticsearch.buildFilterNode({ spec: elasticsearchSpec, node, resolveDate });
    return `client.search({ index: "products", query: ${json(query ?? { match_all: {} })} })`;
  });
  const url = attempt(() => {
    const compact = isList
      ? compactFilters({ filters }).compact
      : compactFilterNode({ node }).compact;
    const verbose = encodeURIComponent(JSON.stringify(parsed));
    const small = encodeURIComponent(JSON.stringify(compact));
    return `${json(compact)}\n\n// URL-encoded JSON: ${verbose.length} chars verbose → ${small.length} chars compact\n// (with a Rison codec the compact form gets shorter still)`;
  });
  const chips = attempt(() => {
    const leaves: ColumnFilter[] = [];
    const walk = (n: FilterNode) => {
      if (n.type === "column") leaves.push({ field: n.field, filter: n.filter });
      else if (n.type === "not") walk(n.node);
      else n.nodes.forEach(walk);
    };
    if (isList) leaves.push(...filters);
    else walk(node);
    return (
      leaves
        // Like the compiler: a field outside the spec, or with the wrong kind, is dropped.
        .filter((l) => kinds[l.field as keyof typeof kinds] === l.filter?.kind)
        .map((columnFilter) =>
          describeColumnFilter({
            columnFilter,
            label: labels[columnFilter.field as keyof typeof labels] ?? columnFilter.field,
            describeDate,
          }),
        )
        .map((l) => `• ${l}`)
        .join("\n")
    );
  });
  return {
    input: isList ? "list" : "tree",
    ast,
    sql,
    mongo: mongoOut,
    prisma: prismaOut,
    postgrest: postgrestOut,
    elasticsearch: elasticsearchOut,
    url,
    labels: chips,
  };
}

export const examples: { label: string; value: unknown }[] = [
  {
    label: "Flat list (AND)",
    value: [
      { field: "name", filter: { kind: "text", operator: "contains", value: "lamp" } },
      { field: "price", filter: { kind: "number", operator: "between", from: 10, to: 100 } },
      {
        field: "status",
        filter: { kind: "enum", operator: "inArray", values: ["active", "draft"] },
      },
    ],
  },
  {
    label: "Boolean tree (and / or / not)",
    value: {
      type: "and",
      nodes: [
        {
          type: "column",
          field: "inStock",
          filter: { kind: "boolean", operator: "eq", value: true },
        },
        {
          type: "not",
          node: {
            type: "or",
            nodes: [
              {
                type: "column",
                field: "name",
                filter: { kind: "text", operator: "startsWith", value: "tmp" },
              },
              {
                type: "column",
                field: "price",
                filter: { kind: "number", operator: "lt", value: 0 },
              },
            ],
          },
        },
      ],
    },
  },
  {
    label: "Date preset (this month, LA)",
    value: [
      {
        field: "createdAt",
        filter: {
          kind: "date",
          operator: "is",
          unit: "month",
          timeZone: "America/Los_Angeles",
          anchor: "2026-03-15T12:00:00",
        },
      },
    ],
  },
  {
    label: "Arrays + nulls",
    value: [
      {
        field: "tags",
        filter: { kind: "array", operator: "arrayOverlaps", values: ["sale", "new"] },
      },
      { field: "price", filter: { kind: "number", operator: "isNotNull" } },
    ],
  },
  {
    label: "Dropped fields",
    value: [
      { field: "name", filter: { kind: "text", operator: "eq", value: "kept" } },
      {
        field: "password",
        filter: { kind: "text", operator: "eq", value: "not in the spec → dropped" },
      },
      {
        field: "price",
        filter: { kind: "text", operator: "eq", value: "kind mismatch → dropped" },
      },
    ],
  },
];
