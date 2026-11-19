import {
  arrayContained,
  arrayContains,
  arrayOverlaps,
  getOperators,
  getTableColumns,
  type SQL,
} from "drizzle-orm";
import { MySqlDialect, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { integer, PgDialect, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pg-proxy";
import { integer as sqliteInteger, sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vitest";

import type { ColumnFilter, DatePreset, FilterNode } from "../src/filters/types.ts";
import * as rqb from "../src/filters/drizzle-rqb.ts";

const resolveDate = ({ value }: { value: DatePreset }) => {
  const start = new Date(`${value.anchor}Z`);
  const end = value.end ? new Date(`${value.end}Z`) : new Date(start.getTime() + 86_400_000);

  return { start, end };
};

const spec = {
  name: rqb.textField({ column: "name" }),
  amount: rqb.numberField({ column: "amount" }),
  status: rqb.enumField({ column: "status" }),
  tags: rqb.arrayField({ column: "tags" }),
  createdAt: rqb.dateField({ column: "createdAt" }),
};

const one = (f: ColumnFilter) => {
  const { where } = rqb.buildWhere({ spec, filters: [f] });
  const key = Object.keys((where as Record<string, unknown>) ?? {})[0] ?? "";

  return (where as Record<string, unknown>)?.[key];
};

describe("drizzle-rqb adapter — column → RQBv2 condition object", () => {
  test("scalar ops", () => {
    expect(one({ field: "amount", filter: { kind: "number", operator: "eq", value: 3 } })).toEqual({
      eq: 3,
    });
    expect(one({ field: "amount", filter: { kind: "number", operator: "ne", value: 3 } })).toEqual({
      ne: 3,
    });
    expect(one({ field: "amount", filter: { kind: "number", operator: "gte", value: 3 } })).toEqual(
      { gte: 3 },
    );
  });

  test("text-match → like/ilike (contains/startsWith/endsWith lower to ilike + %)", () => {
    expect(
      one({ field: "name", filter: { kind: "text", operator: "contains", value: "ab" } }),
    ).toEqual({ ilike: "%ab%" });
    expect(
      one({ field: "name", filter: { kind: "text", operator: "startsWith", value: "a" } }),
    ).toEqual({ ilike: "a%" });
    expect(
      one({ field: "name", filter: { kind: "text", operator: "like", value: "a%b" } }),
    ).toEqual({ like: "a%b" });
    expect(
      one({ field: "name", filter: { kind: "text", operator: "notIlike", value: "a%" } }),
    ).toEqual({ notIlike: "a%" });
  });

  test("set / array / null ops", () => {
    expect(
      one({ field: "status", filter: { kind: "enum", operator: "inArray", values: ["a", "b"] } }),
    ).toEqual({ in: ["a", "b"] });
    expect(
      one({ field: "status", filter: { kind: "enum", operator: "notInArray", values: ["a"] } }),
    ).toEqual({ notIn: ["a"] });
    expect(
      one({ field: "tags", filter: { kind: "array", operator: "arrayContains", values: ["x"] } }),
    ).toEqual({ arrayContains: ["x"] });
    expect(
      one({ field: "tags", filter: { kind: "array", operator: "arrayContained", values: ["x"] } }),
    ).toEqual({ arrayContained: ["x"] });
    expect(
      one({ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["x"] } }),
    ).toEqual({ arrayOverlaps: ["x"] });
    expect(one({ field: "amount", filter: { kind: "number", operator: "isNull" } })).toEqual({
      isNull: true,
    });
    expect(one({ field: "amount", filter: { kind: "number", operator: "isNotNull" } })).toEqual({
      isNotNull: true,
    });
  });

  test("between → AND of gte/lte (no native between); date preset → AND of gte/lt", () => {
    expect(
      rqb.buildWhere({
        spec,
        filters: [
          { field: "amount", filter: { kind: "number", operator: "between", from: 1, to: 9 } },
        ],
      }).where,
    ).toEqual({ AND: [{ amount: { gte: 1 } }, { amount: { lte: 9 } }] });

    const dated = rqb.buildWhere({
      spec,
      filters: [
        {
          field: "createdAt",
          filter: {
            kind: "date",
            operator: "is",
            unit: "day",
            timeZone: "UTC",
            anchor: "2026-02-14T00:00:00",
          },
        },
      ],
      resolveDate,
    }).where;
    expect(dated).toHaveProperty("AND");
  });

  test("whole AND list + drops non-allow-listed", () => {
    const filters: ColumnFilter[] = [
      { field: "name", filter: { kind: "text", operator: "contains", value: "ab" } },
      { field: "secret", filter: { kind: "text", operator: "eq", value: "x" } }, // dropped
      { field: "amount", filter: { kind: "number", operator: "gt", value: 5 } },
    ];
    expect(rqb.buildWhere({ spec, filters }).where).toEqual({
      AND: [{ name: { ilike: "%ab%" } }, { amount: { gt: 5 } }],
    });
  });

  test("buildFilterNode → AND/OR/NOT", () => {
    const node: FilterNode = {
      type: "not",
      node: {
        type: "or",
        nodes: [
          { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "a" } },
          { type: "column", field: "amount", filter: { kind: "number", operator: "gt", value: 5 } },
        ],
      },
    };
    expect(rqb.buildFilterNode({ spec, node }).where).toEqual({
      NOT: { OR: [{ name: { eq: "a" } }, { amount: { gt: 5 } }] },
    });
  });

  test("empty / all-dropped → undefined", () => {
    expect(rqb.buildWhere({ spec, filters: [] }).where).toBeUndefined();
    expect(
      rqb.buildWhere({
        spec,
        filters: [{ field: "ghost", filter: { kind: "text", operator: "eq", value: "x" } }],
      }).where,
    ).toBeUndefined();
  });
});

// RQB v1 runs against drizzle's REAL operators (`getOperators()` is exactly what drizzle passes
// the callback) and real columns; the SQL is inspected through PgDialect, no database needed.
const tasks = pgTable("tasks", {
  id: integer("id").primaryKey(),
  name: text("name"),
  amount: integer("amount"),
  status: text("status"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at"),
});
const ops = getOperators();
// the table fields the RQB v1 callback receives, keyed by schema property name
const fields = getTableColumns(tasks);
const dialect = new PgDialect();
const toSql = (s: SQL | undefined) => {
  if (s === undefined) return undefined;
  const { sql, params } = dialect.sqlToQuery(s);

  return { sql, params };
};

describe("drizzle-rqb v1 callback adapter", () => {
  test("builds via the callback ops + fields (resolves the aliased column, not raw)", () => {
    const { where } = rqb.buildRqbV1Where({
      spec,
      filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "ab" } }],
    });

    expect(toSql(where(fields, ops))).toEqual({
      sql: '"tasks"."name" ilike $1',
      params: ["%ab%"],
    });
  });

  test("AND list, set/array/null ops, between → and(gte,lte)", () => {
    const { where } = rqb.buildRqbV1Where({
      spec,
      filters: [
        { field: "status", filter: { kind: "enum", operator: "inArray", values: ["a"] } },
        { field: "amount", filter: { kind: "number", operator: "between", from: 1, to: 9 } },
        { field: "tags", filter: { kind: "array", operator: "arrayContains", values: ["x"] } },
      ],
    });

    expect(toSql(where(fields, ops))).toEqual({
      sql: '("tasks"."status" in ($1) and ("tasks"."amount" >= $2 and "tasks"."amount" <= $3) and "tasks"."tags" @> $4)',
      params: ["a", 1, 9, '{"x"}'],
    });
  });

  test("array ops with drizzle's real operators match drizzle's own array operators", () => {
    // Regression: drizzle 0.45's getOperators() has no array ops, so the callback threw
    // "ops.arrayOverlaps is not a function". They are now built with the `sql` tag it does carry.
    const cases = [
      ["arrayContains", arrayContains, "@>"],
      ["arrayContained", arrayContained, "<@"],
      ["arrayOverlaps", arrayOverlaps, "&&"],
    ] as const;
    for (const [operator, drizzleOp, sqlOp] of cases) {
      const { where } = rqb.buildRqbV1Where({
        spec,
        filters: [{ field: "tags", filter: { kind: "array", operator, values: ["a", "b"] } }],
      });
      const out = toSql(where(fields, ops));

      expect(out).toEqual({ sql: `"tasks"."tags" ${sqlOp} $1`, params: ['{"a","b"}'] });
      expect(out).toEqual(toSql(drizzleOp(fields.tags, ["a", "b"])));
    }
  });

  test("an operators object that carries its own array ops uses them", () => {
    const { where } = rqb.buildRqbV1Where({
      spec,
      filters: [
        { field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["a"] } },
      ],
    });
    let called = 0;
    const withArrayOps = {
      ...ops,
      arrayOverlaps: (column: unknown, values: unknown[]) => {
        called++;

        return arrayOverlaps(column as typeof fields.tags, values as string[]);
      },
    };

    expect(toSql(where(fields, withArrayOps))).toEqual({
      sql: '"tasks"."tags" && $1',
      params: ['{"a"}'],
    });
    expect(called).toBe(1);
  });

  test("db.query.<table>.findMany accepts the callback and runs it on the aliased table", async () => {
    const queries: { sql: string; params: unknown[] }[] = [];
    const db = drizzle(
      async (sql, params) => {
        queries.push({ sql, params });

        return { rows: [] };
      },
      { schema: { tasks } },
    );
    const { where } = rqb.buildRqbV1Where({
      spec,
      filters: [
        { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
        { field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts"] } },
      ],
    });

    await db.query.tasks.findMany({ columns: { id: true }, where });

    expect(queries).toEqual([
      {
        sql: 'select "id" from "tasks" "tasks" where ("tasks"."name" ilike $1 and "tasks"."tags" && $2)',
        params: ["Re%", '{"ts"}'],
      },
    ]);
  });

  test("buildRqbV1FilterNode → not(or(...))", () => {
    const { where } = rqb.buildRqbV1FilterNode({
      spec,
      node: {
        type: "not",
        node: {
          type: "or",
          nodes: [
            { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "a" } },
            {
              type: "column",
              field: "amount",
              filter: { kind: "number", operator: "gt", value: 5 },
            },
          ],
        },
      },
    });

    expect(toSql(where(fields, ops))).toEqual({
      sql: 'not ("tasks"."name" = $1 or "tasks"."amount" > $2)',
      params: ["a", 5],
    });
  });

  test("empty / all-dropped callback → undefined", () => {
    expect(rqb.buildRqbV1Where({ spec, filters: [] }).where(fields, ops)).toBeUndefined();
    expect(
      rqb
        .buildRqbV1Where({
          spec,
          filters: [{ field: "ghost", filter: { kind: "text", operator: "eq", value: "x" } }],
        })
        .where(fields, ops),
    ).toBeUndefined();
  });
});

describe("drizzle-rqb v1 text ops on SQLite / MySQL columns", () => {
  // Regression: v1 rendered drizzle's `ilike` (a syntax error on SQLite/MySQL) and the
  // backslash-escaped pattern had no ESCAPE clause (SQLite has no default escape).
  const client = new DatabaseSync(":memory:");
  client.exec("create table t (id integer primary key, name text)");
  const insert = client.prepare("insert into t (name) values (?)");
  for (const name of ["50% off", "500 off", "a_b", "axb", "Ada"]) insert.run(name);
  const t = sqliteTable("t", { id: sqliteInteger("id").primaryKey(), name: sqliteText("name") });
  const db = drizzleSqliteProxy(
    async (sqlText, params, method) => {
      const rows = client
        .prepare(sqlText)
        .all(...(params as string[]))
        .map((row) => Object.values(row));

      // sqlite-proxy wants one row's values for "get", every row's values otherwise
      return { rows: (method === "get" ? rows[0] : rows) as unknown[] };
    },
    { schema: { t } },
  );
  const nameSpec = { name: rqb.textField({ column: "name" }) };

  test.each([
    ["contains", "50%", ["50% off"]],
    ["contains", "a_b", ["a_b"]],
    ["startsWith", "ad", ["Ada"]],
    ["notIlike", "%off", ["Ada", "a_b", "axb"]],
  ] as const)("findMany on SQLite: %s %j", async (operator, value, want) => {
    const { where } = rqb.buildRqbV1Where({
      spec: nameSpec,
      filters: [{ field: "name", filter: { kind: "text", operator, value } }],
    });
    const rows = await db.query.t.findMany({ columns: { name: true }, where });

    expect(rows.map((r) => r.name).sort()).toEqual(want);
  });

  test("MySQL column renders like … escape char(92)", () => {
    const m = mysqlTable("t", { name: varchar("name", { length: 50 }) });
    const { where } = rqb.buildRqbV1Where({
      spec: nameSpec,
      filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "50%" } }],
    });
    const { sql, params } = new MySqlDialect().sqlToQuery(where(getTableColumns(m), ops)!);

    expect({ sql, params }).toEqual({
      sql: "`t`.`name` like ? escape char(92)",
      params: ["%50\\%%"],
    });
  });
});
