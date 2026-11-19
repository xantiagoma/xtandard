import { DatabaseSync } from "node:sqlite";

import { describe, expect, test } from "vitest";
import { MySqlDialect, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { boolean, integer, PgDialect, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { SQLiteSyncDialect, sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { drizzle as drizzleSqliteProxy } from "drizzle-orm/sqlite-proxy";

import type { ColumnFilter, DatePreset, FilterNode } from "../src/filters/types.ts";

import { buildFilterNode, buildWhere } from "../src/filters/drizzle/where.ts";
import {
  booleanField,
  dateField,
  enumField,
  numberField,
  textField,
} from "../src/filters/drizzle/spec.ts";

// A throwaway table to render real SQL against — no database needed, just the
// dialect's SQL serializer. This also exercises the compile-time spec
// constraints (a wrong-typed column would fail to type-check here).
const tbl = pgTable("tbl", {
  name: text("name"),
  status: text("status", { enum: ["queued", "running", "done"] }),
  amount: integer("amount"),
  active: boolean("active"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }),
  transactedAt: timestamp("transacted_at", { withTimezone: true, mode: "date" }),
});

const spec = {
  name: textField({ column: tbl.name }),
  status: enumField({ column: tbl.status }),
  amount: numberField({ column: tbl.amount }),
  active: booleanField({ column: tbl.active }),
  createdAt: dateField({ column: tbl.createdAt }),
  transactedAt: dateField({ column: tbl.transactedAt }),
};

const dialect = new PgDialect();

// A minimal date resolver (the real DST-aware one is injected by the consumer):
// `between` → [anchor, end); a unit preset → [anchor, anchor + 1 day).
const resolveDate = ({ value }: { value: DatePreset }) => {
  const start = new Date(`${value.anchor}Z`);
  const end = value.end ? new Date(`${value.end}Z`) : new Date(start.getTime() + 86_400_000);

  return { start, end };
};

function render(filters: ColumnFilter[]) {
  const { where } = buildWhere({ spec, filters, resolveDate });

  return where ? dialect.sqlToQuery(where) : null;
}

describe("buildWhere", () => {
  test("the motivating case: createdAt in a range AND transactedAt on a day", () => {
    const q = render([
      {
        field: "createdAt",
        filter: {
          kind: "date",
          operator: "between",
          unit: "day",
          timeZone: "UTC",
          anchor: "2026-01-01T00:00:00",
          end: "2026-01-31T00:00:00",
        },
      },
      {
        field: "transactedAt",
        filter: {
          kind: "date",
          operator: "is",
          unit: "day",
          timeZone: "UTC",
          anchor: "2026-02-14T00:00:00",
        },
      },
    ]);

    expect(q).not.toBeNull();
    const sql = q?.sql.toLowerCase() ?? "";
    expect(sql).toContain('"created_at" >=');
    expect(sql).toContain('"created_at" <');
    expect(sql).toContain('"transacted_at" >=');
    expect(sql).toContain(" and ");
    expect(q?.params).toHaveLength(4);
  });

  test("enum inArray", () => {
    const q = render([
      {
        field: "status",
        filter: { kind: "enum", operator: "inArray", values: ["running", "queued"] },
      },
    ]);

    expect(q?.sql.toLowerCase()).toContain('"status" in (');
    expect(q?.params).toEqual(["running", "queued"]);
  });

  test("text contains lowers to escaped ilike", () => {
    const q = render([
      { field: "name", filter: { kind: "text", operator: "contains", value: "a%b" } },
    ]);

    expect(q?.sql.toLowerCase()).toContain("ilike");
    expect(q?.params).toEqual(["%a\\%b%"]);
  });

  test("number between → half-open >= AND <= (never SQL BETWEEN)", () => {
    const q = render([
      { field: "amount", filter: { kind: "number", operator: "between", from: 10, to: 20 } },
    ]);

    const sql = q?.sql.toLowerCase() ?? "";
    expect(sql).toContain(">=");
    expect(sql).toContain("<=");
    expect(sql).not.toContain("between");
    expect(q?.params).toEqual([10, 20]);
  });

  test("boolean eq + isNull", () => {
    const eqQ = render([
      { field: "active", filter: { kind: "boolean", operator: "eq", value: true } },
    ]);
    expect(eqQ?.params).toEqual([true]);

    const nullQ = render([{ field: "active", filter: { kind: "boolean", operator: "isNull" } }]);
    expect(nullQ?.sql.toLowerCase()).toContain("is null");
    expect(nullQ?.params).toHaveLength(0);
  });

  test("a non-allow-listed field is dropped", () => {
    const q = render([
      { field: "secretColumn", filter: { kind: "text", operator: "eq", value: "x" } },
    ]);

    expect(q).toBeNull();
  });

  test("empty filters → no WHERE", () => {
    expect(render([])).toBeNull();
  });

  test("a date preset without an injected resolveDate throws", () => {
    expect(() =>
      buildWhere({
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
      }),
    ).toThrow();
  });
});

describe("buildFilterNode (and/or/not)", () => {
  test("renders OR and NOT", () => {
    const node: FilterNode = {
      type: "and",
      nodes: [
        {
          type: "column",
          field: "status",
          filter: { kind: "enum", operator: "eq", value: "running" },
        },
        {
          type: "not",
          node: {
            type: "or",
            nodes: [
              {
                type: "column",
                field: "name",
                filter: { kind: "text", operator: "eq", value: "a" },
              },
              {
                type: "column",
                field: "amount",
                filter: { kind: "number", operator: "gt", value: 5 },
              },
            ],
          },
        },
      ],
    };

    const { where } = buildFilterNode({ spec, node, resolveDate });
    expect(where).toBeDefined();
    const q = where ? dialect.sqlToQuery(where) : null;
    const sql = q?.sql.toLowerCase() ?? "";
    expect(sql).toContain(" or ");
    expect(sql).toContain("not ");
    expect(q?.params).toEqual(["running", "a", 5]);
  });
});

// ── text ops per dialect: the dialect comes from the column ─────────────────

describe("text ops on SQLite (drizzle sqlite-proxy over a real node:sqlite)", () => {
  // Regression: the text ops rendered drizzle's `ilike` (a syntax error on SQLite) and the
  // backslash-escaped pattern had no ESCAPE clause (SQLite has no default escape character).
  const client = new DatabaseSync(":memory:");
  client.exec("create table t (name text)");
  const insert = client.prepare("insert into t (name) values (?)");
  for (const name of ["50% off", "500 off", "a_b", "axb", "back\\slash", "backxslash", "Ada"]) {
    insert.run(name);
  }
  const db = drizzleSqliteProxy(async (sqlText, params, method) => {
    const rows = client
      .prepare(sqlText)
      .all(...(params as string[]))
      .map((row) => Object.values(row));

    // sqlite-proxy wants one row's values for "get", every row's values otherwise
    return { rows: (method === "get" ? rows[0] : rows) as unknown[] };
  });
  const t = sqliteTable("t", { name: sqliteText("name") });

  const cases: [
    operator: "contains" | "startsWith" | "endsWith" | "like" | "ilike" | "notIlike",
    value: string,
    want: string[],
  ][] = [
    ["contains", "50%", ["50% off"]],
    ["contains", "a_b", ["a_b"]],
    ["contains", "back\\slash", ["back\\slash"]],
    ["startsWith", "50%", ["50% off"]],
    ["endsWith", "_b", ["a_b"]],
    ["like", "a%", ["Ada", "a_b", "axb"]],
    ["like", "a\\_b", ["a_b"]],
    ["ilike", "ADA", ["Ada"]],
    ["notIlike", "%off", ["Ada", "a_b", "axb", "back\\slash", "backxslash"]],
  ];

  test.each(cases)("%s %j", async (operator, value, want) => {
    const { where } = buildWhere({
      spec: { name: textField({ column: t.name }) },
      filters: [{ field: "name", filter: { kind: "text", operator, value } }],
    });
    const rows = await db.select({ name: t.name }).from(t).where(where);

    expect(rows.map((r) => r.name).sort()).toEqual(want);
  });

  test("renders like … escape '\\' (never ilike)", () => {
    const { where } = buildWhere({
      spec: { name: textField({ column: t.name }) },
      filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "50%" } }],
    });

    expect(new SQLiteSyncDialect().sqlToQuery(where!)).toMatchObject({
      sql: `"t"."name" like ? escape '\\'`,
      params: ["%50\\%%"],
    });
  });
});

describe("text ops on MySQL (generated SQL)", () => {
  const m = mysqlTable("t", { name: varchar("name", { length: 50 }) });
  const sqlOf = (operator: "contains" | "notIlike", value: string) => {
    const { where } = buildWhere({
      spec: { name: textField({ column: m.name }) },
      filters: [{ field: "name", filter: { kind: "text", operator, value } }],
    });
    const { sql, params } = new MySqlDialect().sqlToQuery(where!);

    return { sql, params };
  };

  test("like … escape char(92): `\\` escapes in every sql_mode (incl. NO_BACKSLASH_ESCAPES)", () => {
    expect(sqlOf("contains", "50%")).toEqual({
      sql: "`t`.`name` like ? escape char(92)",
      params: ["%50\\%%"],
    });
    expect(sqlOf("notIlike", "a%")).toEqual({
      sql: "`t`.`name` not like ? escape char(92)",
      params: ["a%"],
    });
  });

  test("Postgres keeps ilike with no ESCAPE clause (backslash is its default escape)", () => {
    const { where } = buildWhere({
      spec: { name: textField({ column: tbl.name }) },
      filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "50%" } }],
    });

    expect(dialect.sqlToQuery(where!).sql).toBe('"tbl"."name" ilike $1');
  });
});
