import { DatabaseSync } from "node:sqlite";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { ColumnFilter, DatePreset, FilterNode, SqlDialect } from "../src/filters/index.ts";
import * as knex from "../src/filters/knex.ts";
import {
  arrayField,
  booleanField,
  buildFilterNode,
  buildOrderBy,
  buildWhere,
  dateField,
  enumField,
  numberField,
  textField,
  toSqlTagWhere,
} from "../src/filters/sql-tag.ts";
import { fakeSqlTag, PGLITE_TIMEOUT, startPglite } from "./sql-tag-helpers.ts";

const resolveDate = ({ value }: { value: DatePreset }) => {
  const start = new Date(`${value.anchor}Z`);
  const end = value.end ? new Date(`${value.end}Z`) : new Date(start.getTime() + 86_400_000);

  return { start, end };
};

const filter = (field: string, f: ColumnFilter["filter"]): ColumnFilter => ({ field, filter: f });

// Every operator of every kind (one filter each), shared by the knex-agreement and the
// real-Postgres suites.
const OPERATOR_CASES: [label: string, filters: ColumnFilter[]][] = [
  ["text eq", [filter("name", { kind: "text", operator: "eq", value: "Rent" })]],
  ["text ne", [filter("name", { kind: "text", operator: "ne", value: "Rent" })]],
  ["text contains", [filter("name", { kind: "text", operator: "contains", value: "50%" })]],
  ["text startsWith", [filter("name", { kind: "text", operator: "startsWith", value: "re" })]],
  ["text endsWith", [filter("name", { kind: "text", operator: "endsWith", value: "_b" })]],
  ["text like", [filter("name", { kind: "text", operator: "like", value: "R%" })]],
  ["text ilike", [filter("name", { kind: "text", operator: "ilike", value: "r%" })]],
  ["text notIlike", [filter("name", { kind: "text", operator: "notIlike", value: "r%" })]],
  [
    "text inArray",
    [filter("name", { kind: "text", operator: "inArray", values: ["Rent", "a_b"] })],
  ],
  ["text notInArray", [filter("name", { kind: "text", operator: "notInArray", values: ["Rent"] })]],
  ["text isNull", [filter("name", { kind: "text", operator: "isNull" })]],
  ["number gt", [filter("amount", { kind: "number", operator: "gt", value: 10 })]],
  ["number lte", [filter("amount", { kind: "number", operator: "lte", value: 10 })]],
  ["number between", [filter("amount", { kind: "number", operator: "between", from: 5, to: 50 })]],
  [
    "number notBetween",
    [filter("amount", { kind: "number", operator: "notBetween", from: 5, to: 50 })],
  ],
  [
    "enum inArray (3 values)",
    [filter("status", { kind: "enum", operator: "inArray", values: ["open", "done", "x"] })],
  ],
  ["enum ne", [filter("status", { kind: "enum", operator: "ne", value: "open" })]],
  ["boolean eq", [filter("done", { kind: "boolean", operator: "eq", value: true })]],
  ["boolean isNotNull", [filter("done", { kind: "boolean", operator: "isNotNull" })]],
  [
    "date is (day)",
    [
      filter("createdAt", {
        kind: "date",
        operator: "is",
        unit: "day",
        timeZone: "UTC",
        anchor: "2026-01-02T00:00:00",
      }),
    ],
  ],
  [
    "array arrayContains",
    [filter("tags", { kind: "array", operator: "arrayContains", values: ["a", "b"] })],
  ],
  [
    "array arrayContained",
    [filter("tags", { kind: "array", operator: "arrayContained", values: ["a", "b"] })],
  ],
  [
    "array arrayOverlaps",
    [filter("tags", { kind: "array", operator: "arrayOverlaps", values: ["c"] })],
  ],
  [
    "AND of four",
    [
      filter("name", { kind: "text", operator: "contains", value: "e" }),
      filter("amount", { kind: "number", operator: "gte", value: 1 }),
      filter("status", { kind: "enum", operator: "inArray", values: ["open", "done"] }),
      filter("done", { kind: "boolean", operator: "eq", value: false }),
    ],
  ],
];

const sqlTagSpec = {
  name: textField({ column: "name" }),
  amount: numberField({ column: "amount" }),
  status: enumField({ column: "status" }),
  done: booleanField({ column: "done" }),
  createdAt: dateField({ column: "created_at" }),
  tags: arrayField({ column: "tags" }),
};
const knexSpec = {
  name: knex.textField({ column: "name" }),
  amount: knex.numberField({ column: "amount" }),
  status: knex.enumField({ column: "status" }),
  done: knex.booleanField({ column: "done" }),
  createdAt: knex.dateField({ column: "created_at" }),
  tags: knex.arrayField({ column: "tags" }),
};

describe("sql-tag renders the same SQL as the knex adapter (every op × dialect)", () => {
  const dialects: SqlDialect[] = ["postgres", "mysql", "sqlite"];

  for (const dialect of dialects) {
    test.each(OPERATOR_CASES)(`${dialect}: %s`, (_label, filters) => {
      const { sql, render } = fakeSqlTag(dialect);
      const { where } = buildWhere({ sql, spec: sqlTagSpec, filters, resolveDate, dialect });
      const expected = knex.buildWhereSql({ spec: knexSpec, filters, resolveDate, dialect });

      expect(render(where)).toEqual(expected);
    });
  }

  test("filter trees (and/or/not) match buildFilterNodeSql", () => {
    const node: FilterNode = {
      type: "or",
      nodes: [
        { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
        {
          type: "not",
          node: {
            type: "and",
            nodes: [
              {
                type: "column",
                field: "amount",
                filter: { kind: "number", operator: "lt", value: 0 },
              },
              { type: "column", field: "secret", filter: { kind: "text", operator: "isNull" } },
              { type: "column", field: "done", filter: { kind: "boolean", operator: "isNull" } },
            ],
          },
        },
      ],
    };
    const { sql, render } = fakeSqlTag();
    const { where } = buildFilterNode({ sql, spec: sqlTagSpec, node });

    expect(render(where)).toEqual(knex.buildFilterNodeSql({ spec: knexSpec, node }));
    expect(render(where)).toEqual({
      sql: '("name" = ? OR NOT (("amount" < ? AND "done" IS NULL)))',
      bindings: ["Rent", 0],
    });
  });

  test("a long IN list keeps every value as its own parameter, in order", () => {
    const values = Array.from({ length: 1000 }, (_, i) => `v${i}`);
    const filters = [filter("status", { kind: "enum", operator: "inArray", values })];
    const { sql, render } = fakeSqlTag();

    expect(render(buildWhere({ sql, spec: sqlTagSpec, filters }).where)).toEqual(
      knex.buildWhereSql({ spec: knexSpec, filters }),
    );
  });
});

describe("sql-tag adapter API", () => {
  test("nothing allow-listed (or no filters) → where undefined", () => {
    const { sql } = fakeSqlTag();

    expect(buildWhere({ sql, spec: sqlTagSpec, filters: [] }).where).toBeUndefined();
    expect(
      buildWhere({
        sql,
        spec: sqlTagSpec,
        filters: [filter("secret", { kind: "text", operator: "eq", value: "x" })],
      }).where,
    ).toBeUndefined();
    expect(toSqlTagWhere({ sql, where: null, columns: {} })).toBeUndefined();
  });

  test("table.column strings are quoted per part by the client; values never reach the text", () => {
    const { sql, render } = fakeSqlTag("mysql");
    const { where } = buildWhere({
      sql,
      spec: { status: enumField({ column: "tasks.status" }) },
      filters: [filter("status", { kind: "enum", operator: "eq", value: "x' OR 1=1 --" })],
      dialect: "mysql",
    });

    expect(render(where)).toEqual({ sql: "`tasks`.`status` = ?", bindings: ["x' OR 1=1 --"] });
  });

  test("rejects a column string that isn't a plain identifier", () => {
    const { sql } = fakeSqlTag();
    for (const column of ['name"; drop table t; --', "lower(name)", "a..b", "1col", ""]) {
      expect(() =>
        buildWhere({
          sql,
          spec: { name: textField({ column }) },
          filters: [filter("name", { kind: "text", operator: "eq", value: "x" })],
        }),
      ).toThrow(`filters/sql-tag: invalid SQL identifier "${column}"`);
    }
  });

  test("a fragment target is embedded as it is (computed expressions)", () => {
    const { sql, render } = fakeSqlTag();
    const { where } = buildWhere({
      sql,
      spec: { name: textField({ column: sql`lower(${sql("users.name")})` }) },
      filters: [filter("name", { kind: "text", operator: "eq", value: "ann" })],
    });

    expect(render(where)).toEqual({ sql: 'lower("users"."name") = ?', bindings: ["ann"] });
  });

  test("buildOrderBy: one comma-joined fragment, allow-listed, with defaultSort fallback", () => {
    const { sql, render } = fakeSqlTag();
    const columns = { name: "tasks.name", amount: "tasks.amount", id: sql`"tasks".id` };

    expect(
      render(
        buildOrderBy({
          sql,
          sort: [
            { field: "amount", dir: "desc" },
            { field: "password", dir: "asc" },
            { field: "name", dir: "asc" },
            { field: "id", dir: "desc" },
          ],
          columns,
        }).orderBy,
      ),
    ).toEqual({ sql: '"tasks"."amount" DESC, "tasks"."name" ASC, "tasks".id DESC', bindings: [] });
    expect(
      render(
        buildOrderBy({
          sql,
          sort: [{ field: "password", dir: "asc" }],
          columns,
          defaultSort: [{ field: "name", dir: "asc" }],
        }).orderBy,
      ),
    ).toEqual({ sql: '"tasks"."name" ASC', bindings: [] });
    expect(buildOrderBy({ sql, sort: [], columns }).orderBy).toBeUndefined();
  });

  test("a date preset without resolveDate throws (like every adapter)", () => {
    const { sql } = fakeSqlTag();

    expect(() =>
      buildWhere({
        sql,
        spec: sqlTagSpec,
        filters: [
          filter("createdAt", {
            kind: "date",
            operator: "is",
            unit: "day",
            timeZone: "UTC",
            anchor: "2026-01-02T00:00:00",
          }),
        ],
      }),
    ).toThrow();
  });
});

// ── LIKE escaping + json_each array ops, run on a real SQLite (node:sqlite) ──

describe("dialect sqlite on a real SQLite (node:sqlite)", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("create table t (name text, tags text)");
  const insert = db.prepare("insert into t (name, tags) values (?, ?)");
  const seed: [name: string, tags: string][] = [
    ["50% off", '["a","b"]'],
    ["500 off", '["a"]'],
    ["a_b", '["c"]'],
    ["axb", "[]"],
    ["back\\slash", '["a","b","c"]'],
    ["Ada", '["b"]'],
  ];
  for (const [name, tags] of seed) {
    insert.run(name, tags);
  }
  const names = (filters: ColumnFilter[]) => {
    const { sql, render } = fakeSqlTag("sqlite");
    const { where } = buildWhere({
      sql,
      spec: { name: textField({ column: "name" }), tags: arrayField({ column: "tags" }) },
      filters,
      dialect: "sqlite",
    });
    const q = render(where);

    return db
      .prepare(`select name from t where ${q.sql}`)
      .all(...(q.bindings as string[]))
      .map((row) => row.name)
      .sort();
  };

  test.each([
    ["contains", "50%", ["50% off"]],
    ["contains", "a_b", ["a_b"]],
    ["contains", "back\\slash", ["back\\slash"]],
    ["startsWith", "50%", ["50% off"]],
    ["endsWith", "_b", ["a_b"]],
    ["like", "a%", ["Ada", "a_b", "axb"]],
    ["like", "a\\_b", ["a_b"]],
  ] as const)("text %s %j", (operator, value, want) => {
    expect(names([filter("name", { kind: "text", operator, value })])).toEqual(want);
  });

  test.each([
    ["arrayContains", ["a", "b"], ["50% off", "back\\slash"]],
    ["arrayContained", ["a", "b"], ["50% off", "500 off", "Ada", "axb"]],
    ["arrayOverlaps", ["c"], ["a_b", "back\\slash"]],
  ] as const)("array %s %j", (operator, values, want) => {
    expect(names([filter("tags", { kind: "array", operator, values: [...values] })])).toEqual(want);
  });
});

// ── postgres.js on a real Postgres (PGlite over a socket) ────────────────────

describe("postgres.js on a real Postgres (PGlite)", () => {
  let pg: Awaited<ReturnType<typeof startPglite>>;

  beforeAll(async () => {
    pg = await startPglite();
    const { sql } = pg;
    await sql`create table tasks (
      id int primary key, name text, amount int, status text, done boolean,
      created_at timestamptz, tags text[]
    )`;
    const rows = [
      [1, "Rent", 1200, "open", false, "2026-01-01T10:00:00Z", ["a", "b"]],
      [2, "rent refund", -50, "done", true, "2026-01-02T10:00:00Z", ["a"]],
      [3, "50% off", 5, "open", null, "2026-01-02T23:59:59Z", ["c"]],
      [4, "a_b", 50, null, true, "2026-01-03T00:00:00Z", []],
      [5, "axb", 10, "done", false, null, ["a", "b", "c"]],
      [6, null, null, "x", true, "2026-01-05T00:00:00Z", null],
    ] as const;
    for (const [id, name, amount, status, done, createdAt, tags] of rows) {
      await sql`insert into tasks values (
        ${id}, ${name}, ${amount}, ${status}, ${done},
        ${createdAt ? new Date(createdAt) : null}, ${tags ? [...tags] : null}
      )`;
    }
  }, PGLITE_TIMEOUT);
  afterAll(async () => {
    await pg?.stop();
  }, PGLITE_TIMEOUT);

  const ids = async (filters: ColumnFilter[]) => {
    const { sql } = pg;
    const { where } = buildWhere({ sql, spec: sqlTagSpec, filters, resolveDate });
    const rows = await sql<{ id: number }[]>`
      select id from tasks ${where ? sql`where ${where}` : sql``} order by id
    `;

    return rows.map((r) => r.id);
  };

  const expected: Record<string, number[]> = {
    "text eq": [1],
    "text ne": [2, 3, 4, 5],
    "text contains": [3],
    "text startsWith": [1, 2],
    "text endsWith": [4],
    "text like": [1],
    "text ilike": [1, 2],
    "text notIlike": [3, 4, 5],
    "text inArray": [1, 4],
    "text notInArray": [2, 3, 4, 5],
    "text isNull": [6],
    "number gt": [1, 4],
    "number lte": [2, 3, 5],
    "number between": [3, 4, 5],
    "number notBetween": [1, 2],
    "enum inArray (3 values)": [1, 2, 3, 5, 6],
    "enum ne": [2, 5, 6],
    "boolean eq": [2, 4, 6],
    "boolean isNotNull": [1, 2, 4, 5, 6],
    "date is (day)": [2, 3],
    "array arrayContains": [1, 5],
    "array arrayContained": [1, 2, 4],
    "array arrayOverlaps": [3, 5],
    "AND of four": [1],
  };

  test.each(OPERATOR_CASES)("%s", async (label, filters) => {
    expect(await ids(filters)).toEqual(expected[label]);
  });

  test("no filters → the where fragment is omitted", async () => {
    expect(await ids([])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("the rendered statement (postgres.js numbers the nested parameters)", async () => {
    const { sql } = pg;
    const { where } = buildWhere({
      sql,
      spec: {
        name: textField({ column: "tasks.name" }),
        amount: numberField({ column: "amount" }),
      },
      filters: [
        filter("name", { kind: "text", operator: "startsWith", value: "Re" }),
        filter("amount", { kind: "number", operator: "gte", value: 100 }),
      ],
    });
    const described = await sql`select * from tasks where ${where!}`.describe();

    expect(described.string).toBe(
      'select * from tasks where ("tasks"."name" ILIKE $1 AND "amount" >= $2)',
    );
  });

  test("buildFilterNode + buildOrderBy compose into one query; fragments are reusable", async () => {
    const { sql } = pg;
    const { where } = buildFilterNode({
      sql,
      spec: sqlTagSpec,
      node: {
        type: "or",
        nodes: [
          { type: "column", field: "status", filter: { kind: "enum", operator: "eq", value: "x" } },
          {
            type: "not",
            node: {
              type: "column",
              field: "amount",
              filter: { kind: "number", operator: "gte", value: 0 },
            },
          },
        ],
      },
    });
    const { orderBy } = buildOrderBy({
      sql,
      sort: [{ field: "name", dir: "desc" }],
      columns: { name: "name" },
    });
    const run = () =>
      sql<{ id: number }[]>`select id from tasks where ${where!} order by ${orderBy!} nulls last`;

    expect((await run()).map((r) => r.id)).toEqual([2, 6]);
    expect((await run()).map((r) => r.id)).toEqual([2, 6]);
  });

  test("works inside a transaction (the transaction's sql is a tag too)", async () => {
    const rows = await pg.sql.begin(async (tx) => {
      const { where } = buildWhere({
        sql: tx,
        spec: sqlTagSpec,
        filters: [filter("done", { kind: "boolean", operator: "eq", value: false })],
      });

      return tx<{ id: number }[]>`select id from tasks where ${where!} order by id`;
    });

    expect(rows.map((r) => r.id)).toEqual([1, 5]);
  });
});
