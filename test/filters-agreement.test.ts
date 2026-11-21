// Cross-adapter agreement: one fixture, loaded into a real SQLite (node:sqlite), and a matrix
// of filters run through the in-memory predicate (`dialect: "sqlite"`) AND through the SQL
// adapters (knex SQL, kysely, drizzle) executed on that database. Every filter must select the
// same row ids everywhere. The sort comparator is checked against SQLite `ORDER BY` the same
// way. Where the default (Postgres) semantics differ from SQLite, explicit tests pin it.
import { DatabaseSync } from "node:sqlite";

import { describe, expect, test } from "vitest";
import {
  DummyDriver,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  sql,
} from "kysely";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";

import type { DatePreset, FieldFilter, FilterNode, Sort } from "../src/filters/types.ts";
import * as drizzle from "../src/filters/drizzle/index.ts";
import * as knex from "../src/filters/knex.ts";
import * as kysely from "../src/filters/kysely.ts";
import * as memory from "../src/filters/memory.ts";

// ── fixture ─────────────────────────────────────────────────────────────────

type Row = {
  id: number;
  name: string | null;
  amount: number | null;
  status: string | null;
  done: boolean | null;
  createdAt: Date | null;
  tags: (string | number)[] | null;
};

const d = (iso: string) => new Date(iso);
const rows: Row[] = [
  {
    id: 1,
    name: "Ada",
    amount: 10,
    status: "open",
    done: true,
    createdAt: d("2026-01-01T00:00:00Z"),
    tags: ["a", "b"],
  },
  {
    id: 2,
    name: "ada lovelace",
    amount: -5.5,
    status: "done",
    done: false,
    createdAt: d("2026-01-15T12:00:00Z"),
    tags: ["b"],
  },
  { id: 3, name: null, amount: null, status: null, done: null, createdAt: null, tags: null },
  {
    id: 4,
    name: "ÁDÁM",
    amount: 0,
    status: "open",
    done: null,
    createdAt: d("2026-02-01T00:00:00Z"),
    tags: [],
  },
  {
    id: 5,
    name: "ádám",
    amount: 100,
    status: "archived",
    done: true,
    createdAt: d("2026-02-28T23:59:59.999Z"),
    tags: ["c", 2],
  },
  {
    id: 6,
    name: "50% off",
    amount: 50,
    status: "done",
    done: false,
    createdAt: d("2026-03-01T00:00:00Z"),
    tags: ["a", "c"],
  },
  { id: 7, name: "500 off", amount: 500, status: null, done: true, createdAt: null, tags: ["a"] },
  {
    id: 8,
    name: "a_b",
    amount: 7,
    status: "open",
    done: false,
    createdAt: d("2026-01-10T00:00:00Z"),
    tags: null,
  },
  {
    id: 9,
    name: "axb",
    amount: 7,
    status: "open",
    done: true,
    createdAt: d("2026-01-10T00:00:00Z"),
    tags: ["b", "a", "a"],
  },
  {
    id: 10,
    name: "back\\slash",
    amount: 3,
    status: "archived",
    done: null,
    createdAt: d("2025-12-31T23:59:59Z"),
    tags: ["2"],
  },
  {
    id: 11,
    name: "backxslash",
    amount: null,
    status: "done",
    done: false,
    createdAt: d("2026-01-02T00:00:00Z"),
    tags: [2],
  },
  {
    id: 12,
    name: "Straße",
    amount: 12.25,
    status: "open",
    done: true,
    createdAt: d("2026-01-20T00:00:00Z"),
    tags: ["ß"],
  },
  {
    id: 13,
    name: "STRASSE",
    amount: -1,
    status: null,
    done: false,
    createdAt: d("2026-01-21T00:00:00Z"),
    tags: ["b", "c"],
  },
  {
    id: 14,
    name: "",
    amount: 0,
    status: "open",
    done: true,
    createdAt: d("2026-02-14T00:00:00Z"),
    tags: [],
  },
  {
    id: 15,
    name: "😀 emoji",
    amount: 1e6,
    status: "archived",
    done: null,
    createdAt: d("2026-02-02T00:00:00Z"),
    tags: ["😀"],
  },
  {
    id: 16,
    name: "École",
    amount: 0.5,
    status: "done",
    done: true,
    createdAt: d("2026-01-31T00:00:00Z"),
    tags: ["a", "b", "c"],
  },
];

const db = new DatabaseSync(":memory:");
db.exec(
  "create table t (id integer primary key, name text, amount real, status text, done integer, created_at integer, tags text)",
);
{
  const insert = db.prepare("insert into t values (?, ?, ?, ?, ?, ?, ?)");
  for (const r of rows) {
    insert.run(
      r.id,
      r.name,
      r.amount,
      r.status,
      r.done === null ? null : Number(r.done),
      r.createdAt?.getTime() ?? null,
      r.tags === null ? null : JSON.stringify(r.tags),
    );
  }
}

// node:sqlite binds numbers/strings/null only: Dates as epoch ms (the column's storage), booleans as 0/1.
const toSqlite = (params: readonly unknown[]) =>
  params.map((p) => (p instanceof Date ? p.getTime() : typeof p === "boolean" ? Number(p) : p)) as (
    | string
    | number
    | null
  )[];
const idsOf = (sqlText: string, params: readonly unknown[] = []) =>
  db
    .prepare(sqlText)
    .all(...toSqlite(params))
    .map((r) => Number(r.id));
const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

// ── adapters ────────────────────────────────────────────────────────────────

const resolveDate = ({ value }: { value: DatePreset }) => {
  const anchor = new Date(`${value.anchor}Z`);
  const dayAfter = new Date(anchor.getTime() + 86_400_000);
  switch (value.operator) {
    case "is":
      return { start: anchor, end: dayAfter };
    case "before":
      return { start: null, end: anchor };
    case "after":
      return { start: dayAfter, end: null };
    case "between":
      return { start: anchor, end: new Date(`${value.end}Z`) };
  }
};

const memorySpec = {
  name: memory.textField({ path: "name" }),
  amount: memory.numberField({ path: "amount" }),
  status: memory.enumField({ path: "status" }),
  done: memory.booleanField({ path: "done" }),
  createdAt: memory.dateField({ path: "createdAt" }),
  tags: memory.arrayField({ path: "tags" }),
};
const knexSpec = {
  name: knex.textField({ column: "name" }),
  amount: knex.numberField({ column: "amount" }),
  status: knex.enumField({ column: "status" }),
  done: knex.booleanField({ column: "done" }),
  createdAt: knex.dateField({ column: "created_at" }),
  tags: knex.arrayField({ column: "tags" }),
};
const kyselySpec = {
  name: kysely.textField({ column: "name" }),
  amount: kysely.numberField({ column: "amount" }),
  status: kysely.enumField({ column: "status" }),
  done: kysely.booleanField({ column: "done" }),
  createdAt: kysely.dateField({ column: "created_at" }),
  tags: kysely.arrayField({ column: "tags" }),
};
const dt = sqliteTable("t", {
  id: integer("id").primaryKey(),
  name: text("name"),
  amount: real("amount"),
  status: text("status"),
  done: integer("done", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
});
// drizzle's array helpers are Postgres-only, so `tags` has no drizzle spec (array ops are skipped).
const drizzleSpec = {
  name: drizzle.textField({ column: dt.name }),
  amount: drizzle.numberField({ column: dt.amount }),
  status: drizzle.enumField({ column: dt.status }),
  done: drizzle.booleanField({ column: dt.done }),
  createdAt: drizzle.dateField({ column: dt.createdAt }),
};

const kdb = new Kysely<Record<string, never>>({
  dialect: {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (k) => new SqliteIntrospector(k),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  },
});
const ddb = drizzleSqliteProxy(async (sqlText, params, method) => {
  const result = db
    .prepare(sqlText)
    .all(...toSqlite(params))
    .map((row) => Object.values(row));

  // sqlite-proxy wants one row's values for "get", every row's values otherwise
  return { rows: (method === "get" ? result[0] : result) as unknown[] };
});

const run = {
  memory: (node: FilterNode) => {
    const { predicate } = memory.buildFilterNodePredicate({
      spec: memorySpec,
      node,
      resolveDate,
      dialect: "sqlite",
    });

    return rows.filter(predicate).map((r) => r.id);
  },
  knex: (node: FilterNode) => {
    const fragment = knex.buildFilterNodeSql({
      spec: knexSpec,
      node,
      resolveDate,
      dialect: "sqlite",
    });

    return idsOf(`select id from t where ${fragment!.sql}`, fragment!.bindings);
  },
  kysely: (node: FilterNode) => {
    const { where } = kysely.buildFilterNode({
      spec: kyselySpec,
      node,
      resolveDate,
      dialect: "sqlite",
    });
    const query = kdb
      .selectFrom("t" as never)
      .select(sql`id`.as("id"))
      .where(where!)
      .compile();

    return idsOf(query.sql, query.parameters);
  },
  drizzle: async (node: FilterNode) => {
    const { where } = drizzle.buildFilterNode({ spec: drizzleSpec, node, resolveDate });
    const result = await ddb.select({ id: dt.id }).from(dt).where(where);

    return result.map((r) => r.id);
  },
};

// ── the filter matrix ───────────────────────────────────────────────────────

const col = (field: keyof typeof memorySpec, filter: FieldFilter): FilterNode => ({
  type: "column",
  field,
  filter,
});
const preset = (operator: DatePreset["operator"], anchor: string, end?: string): FieldFilter => ({
  kind: "date",
  operator,
  unit: "day",
  timeZone: "UTC",
  anchor,
  end,
});

const leaves: [label: string, node: FilterNode][] = [
  // text
  ...(
    [
      ["eq", "Ada"],
      ["eq", ""],
      ["ne", "Ada"],
      ["contains", "ada"],
      ["contains", "50%"],
      ["contains", "_"],
      ["contains", "\\"],
      ["contains", ""],
      ["contains", "ß"],
      ["startsWith", "a"],
      ["startsWith", "ÁD"],
      ["endsWith", "off"],
      ["like", "a%"],
      ["like", "A%"],
      ["like", "a\\_b"],
      ["like", "%ß%"],
      ["like", "_ emoji"],
      ["like", "___"],
      ["ilike", "ádám"],
      ["ilike", "ADA%"],
      ["ilike", "%école"],
      ["notIlike", "%off"],
      ["notIlike", "a%"],
    ] as const
  ).map(([operator, value]): [string, FilterNode] => [
    `name ${operator} ${JSON.stringify(value)}`,
    col("name", { kind: "text", operator, value }),
  ]),
  [
    "name inArray",
    col("name", { kind: "text", operator: "inArray", values: ["Ada", "axb", "nope"] }),
  ],
  ["name notInArray", col("name", { kind: "text", operator: "notInArray", values: ["Ada", ""] })],
  ["name isNull", col("name", { kind: "text", operator: "isNull" })],
  ["name isNotNull", col("name", { kind: "text", operator: "isNotNull" })],
  // number
  ...(
    [
      ["eq", 7],
      ["ne", 7],
      ["lt", 0],
      ["gt", 0],
      ["lte", 7],
      ["gte", 7],
      ["gte", -5.5],
      ["lt", 0.5],
    ] as const
  ).map(([operator, value]): [string, FilterNode] => [
    `amount ${operator} ${value}`,
    col("amount", { kind: "number", operator, value }),
  ]),
  ["amount between", col("amount", { kind: "number", operator: "between", from: 0, to: 50 })],
  ["amount notBetween", col("amount", { kind: "number", operator: "notBetween", from: 0, to: 50 })],
  ["amount inArray", col("amount", { kind: "number", operator: "inArray", values: [7, 100, 0.5] })],
  ["amount inArray []", col("amount", { kind: "number", operator: "inArray", values: [] })],
  [
    "amount notInArray",
    col("amount", { kind: "number", operator: "notInArray", values: [7, 100] }),
  ],
  ["amount notInArray []", col("amount", { kind: "number", operator: "notInArray", values: [] })],
  ["amount isNull", col("amount", { kind: "number", operator: "isNull" })],
  ["amount isNotNull", col("amount", { kind: "number", operator: "isNotNull" })],
  // enum
  ["status eq", col("status", { kind: "enum", operator: "eq", value: "open" })],
  ["status ne", col("status", { kind: "enum", operator: "ne", value: "open" })],
  [
    "status inArray",
    col("status", { kind: "enum", operator: "inArray", values: ["open", "done"] }),
  ],
  ["status notInArray", col("status", { kind: "enum", operator: "notInArray", values: ["open"] })],
  ["status isNull", col("status", { kind: "enum", operator: "isNull" })],
  ["status isNotNull", col("status", { kind: "enum", operator: "isNotNull" })],
  // boolean
  ["done eq true", col("done", { kind: "boolean", operator: "eq", value: true })],
  ["done eq false", col("done", { kind: "boolean", operator: "eq", value: false })],
  ["done ne true", col("done", { kind: "boolean", operator: "ne", value: true })],
  ["done isNull", col("done", { kind: "boolean", operator: "isNull" })],
  ["done isNotNull", col("done", { kind: "boolean", operator: "isNotNull" })],
  // date (resolved to [gte, lt) windows)
  ["createdAt is", col("createdAt", preset("is", "2026-01-10T00:00:00"))],
  ["createdAt before", col("createdAt", preset("before", "2026-02-01T00:00:00"))],
  ["createdAt after", col("createdAt", preset("after", "2026-02-01T00:00:00"))],
  [
    "createdAt between",
    col("createdAt", preset("between", "2026-01-01T00:00:00", "2026-02-01T00:00:00")),
  ],
  ["createdAt isNull", col("createdAt", { kind: "date", operator: "isNull" })],
  ["createdAt isNotNull", col("createdAt", { kind: "date", operator: "isNotNull" })],
  // array (JSON text column on SQLite)
  ...(
    [
      ["arrayContains", ["a"]],
      ["arrayContains", ["a", "b"]],
      ["arrayContains", []],
      ["arrayContains", [2]],
      ["arrayContained", ["a", "b"]],
      ["arrayContained", ["a", "b", "c", 2]],
      ["arrayContained", []],
      ["arrayOverlaps", ["a", "c"]],
      ["arrayOverlaps", [2]],
      ["arrayOverlaps", ["2"]],
      ["arrayOverlaps", ["ß", "😀"]],
      ["arrayOverlaps", []],
    ] as const
  ).map(([operator, values]): [string, FilterNode] => [
    `tags ${operator} ${JSON.stringify(values)}`,
    col("tags", { kind: "array", operator, values: [...values] }),
  ]),
  ["tags isNull", col("tags", { kind: "array", operator: "isNull" })],
  ["tags isNotNull", col("tags", { kind: "array", operator: "isNotNull" })],
];

const find = (label: string) => leaves.find(([l]) => l === label)![1];
const not = (node: FilterNode): FilterNode => ({ type: "not", node });
const and = (...nodes: FilterNode[]): FilterNode => ({ type: "and", nodes });
const or = (...nodes: FilterNode[]): FilterNode => ({ type: "or", nodes });

const trees: [label: string, node: FilterNode][] = [
  ["or(amount gt 0, status isNull)", or(find("amount gt 0"), find("status isNull"))],
  [
    "and(not done eq true, name contains ada)",
    and(not(find("done eq true")), find('name contains "ada"')),
  ],
  ["not(or(status eq, amount lt 0))", not(or(find("status eq"), find("amount lt 0")))],
  ["not(and(status eq, amount gte 7))", not(and(find("status eq"), find("amount gte 7")))],
  [
    "or(not amount between, not tags overlaps)",
    or(not(find("amount between")), not(find('tags arrayOverlaps ["a","c"]'))),
  ],
  ["not(not(name ne))", not(not(find('name ne "Ada"')))],
  [
    "and(createdAt between, or(done isNull, tags contains a))",
    and(find("createdAt between"), or(find("done isNull"), find('tags arrayContains ["a"]'))),
  ],
];

const matrix: [string, FilterNode][] = [
  ...leaves,
  ...leaves.map(([label, node]): [string, FilterNode] => [`not(${label})`, not(node)]),
  ...trees,
];

const readsTags = (node: FilterNode): boolean =>
  node.type === "column"
    ? node.field === "tags"
    : node.type === "not"
      ? readsTags(node.node)
      : node.nodes.some(readsTags);

describe("memory (dialect sqlite) agrees with the SQL adapters on SQLite", () => {
  test.each(matrix)("%s", async (_label, node) => {
    const want = sorted(run.knex(node));

    expect(sorted(run.memory(node))).toEqual(want);
    expect(sorted(run.kysely(node))).toEqual(want);
    if (!readsTags(node)) expect(sorted(await run.drizzle(node))).toEqual(want);
  });

  test("the matrix is not vacuous: most filters select some but not all rows", () => {
    const sizes = matrix.map(([, node]) => run.memory(node).length);
    const partial = sizes.filter((n) => n > 0 && n < rows.length).length;

    expect(partial / sizes.length).toBeGreaterThan(0.8);
  });
});

// ── documented divergences: the default (postgres) semantics vs SQLite ─────

describe("postgres semantics (the default) where SQLite differs", () => {
  const pg = (node: FilterNode) => {
    const { predicate } = memory.buildFilterNodePredicate({ spec: memorySpec, node, resolveDate });

    return sorted(rows.filter(predicate).map((r) => r.id));
  };

  test("ILIKE folds Unicode on Postgres; SQLite's LIKE folds ASCII only", () => {
    const node = find('name ilike "ádám"');
    expect(sorted(run.knex(node))).toEqual([5]);
    expect(pg(node)).toEqual([4, 5]);
    expect(pg(find('name ilike "%école"'))).toEqual([16]);
    expect(sorted(run.knex(find('name ilike "%école"')))).toEqual([]);
  });

  test("LIKE is case-sensitive on Postgres; SQLite's LIKE ignores ASCII case", () => {
    const node = find('name like "A%"');
    expect(sorted(run.knex(node))).toEqual([1, 2, 8, 9]);
    expect(pg(node)).toEqual([1]);
  });

  test("array ops on a NULL array: UNKNOWN on Postgres; an empty list on SQLite", () => {
    const contained = find('tags arrayContained ["a","b"]');
    expect(sorted(run.knex(contained))).toEqual([1, 2, 3, 4, 7, 8, 9, 14]); // 3, 8: NULL tags
    expect(pg(contained)).toEqual([1, 2, 4, 7, 9, 14]);
    const notOverlaps = not(find('tags arrayOverlaps ["a","c"]'));
    expect(sorted(run.knex(notOverlaps))).toEqual([2, 3, 4, 8, 10, 11, 12, 14, 15]);
    expect(pg(notOverlaps)).toEqual([2, 4, 10, 11, 12, 14, 15]);
  });
});

// ── sort comparator vs SQLite ORDER BY ──────────────────────────────────────

describe("buildComparator (dialect sqlite) agrees with SQLite ORDER BY", () => {
  const columns: Record<string, string> = {
    name: "name",
    amount: "amount",
    status: "status",
    done: "done",
    createdAt: "created_at",
    id: "id",
  };
  const paths = Object.fromEntries(Object.keys(columns).map((k) => [k, k]));
  const sorts: Sort[] = [
    [{ field: "name", dir: "asc" }],
    [{ field: "name", dir: "desc" }],
    [{ field: "amount", dir: "asc" }],
    [{ field: "amount", dir: "desc" }],
    [{ field: "createdAt", dir: "desc" }],
    [{ field: "done", dir: "asc" }],
    [
      { field: "status", dir: "asc" },
      { field: "amount", dir: "desc" },
    ],
    [
      { field: "done", dir: "desc" },
      { field: "createdAt", dir: "asc" },
      { field: "name", dir: "desc" },
    ],
  ];
  const memoryIds = (sort: Sort, nulls?: memory.NullsOrder) => {
    const { compare } = memory.buildComparator({
      sort: [...sort, { field: "id", dir: "asc" }],
      paths,
      dialect: "sqlite",
      nulls,
    });

    return [...rows].sort(compare).map((r) => r.id);
  };
  const sqlIds = (sort: Sort, nulls?: memory.NullsOrder) => {
    const keys = sort.map((s) => `${columns[s.field]} ${s.dir}${nulls ? ` nulls ${nulls}` : ""}`);

    return idsOf(`select id from t order by ${[...keys, "id asc"].join(", ")}`);
  };

  test.each(sorts.map((s) => [s.map((i) => `${i.field}:${i.dir}`).join(","), s] as const))(
    "%s",
    (_label, sort) => {
      expect(memoryIds(sort)).toEqual(sqlIds(sort));
      expect(memoryIds(sort, "first")).toEqual(sqlIds(sort, "first"));
      expect(memoryIds(sort, "last")).toEqual(sqlIds(sort, "last"));
    },
  );

  test("keyset pages over the sorted rows match SQLite LIMIT/OFFSET", () => {
    const paginator = memory.createMemoryPaginator({
      rows,
      sort: [{ key: "amount", order: "desc" }, { key: "id" }],
      dialect: "sqlite",
    });
    const pages: number[][] = [];
    let cursor: string | null | undefined;
    for (;;) {
      const page = paginator.paginate({ type: "cursor", limit: 5, cursor });
      pages.push(page.items.map((r) => r.id));
      if (!page.pageInfo.hasNextPage) break;
      cursor = page.pageInfo.endCursor;
    }

    expect(pages).toEqual(
      [0, 5, 10, 15].map((offset) =>
        idsOf(`select id from t order by amount desc, id asc limit 5 offset ${offset}`),
      ),
    );
  });
});
