import { describe, expect, test } from "vitest";
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";

import type { ColumnFilter, DatePreset, FilterNode } from "../src/filters/types.ts";
import { compileFilterNode, compileFilters } from "../src/filters/compile.ts";
import * as mongo from "../src/filters/mongo.ts";
import * as prisma from "../src/filters/prisma.ts";
import * as knex from "../src/filters/knex.ts";
import * as kysely from "../src/filters/kysely.ts";

const resolveDate = ({ value }: { value: DatePreset }) => {
  const start = new Date(`${value.anchor}Z`);
  const end = value.end ? new Date(`${value.end}Z`) : new Date(start.getTime() + 86_400_000);

  return { start, end };
};

// ── core compiler ───────────────────────────────────────────────────────────

describe("compileFilters (portable core)", () => {
  const spec = { name: "text", amount: "number", tags: "array", createdAt: "date" } as const;

  test("keeps text-match ops semantic and drops non-allow-listed / mismatched fields", () => {
    const { where } = compileFilters({
      spec,
      filters: [
        { field: "name", filter: { kind: "text", operator: "contains", value: "a%b" } },
        { field: "secret", filter: { kind: "text", operator: "eq", value: "x" } }, // not allow-listed
        { field: "amount", filter: { kind: "text", operator: "eq", value: "x" } }, // kind mismatch
      ],
    });

    expect(where).toEqual({ type: "cond", cond: { field: "name", op: "contains", value: "a%b" } });
  });

  test("between → gte AND lte; notBetween → lt OR gt (never a between op)", () => {
    const between = compileFilters({
      spec,
      filters: [
        { field: "amount", filter: { kind: "number", operator: "between", from: 1, to: 9 } },
      ],
    }).where;
    expect(between).toEqual({
      type: "and",
      nodes: [
        { type: "cond", cond: { field: "amount", op: "gte", value: 1 } },
        { type: "cond", cond: { field: "amount", op: "lte", value: 9 } },
      ],
    });

    const notBetween = compileFilters({
      spec,
      filters: [
        { field: "amount", filter: { kind: "number", operator: "notBetween", from: 1, to: 9 } },
      ],
    }).where;
    expect(notBetween).toEqual({
      type: "or",
      nodes: [
        { type: "cond", cond: { field: "amount", op: "lt", value: 1 } },
        { type: "cond", cond: { field: "amount", op: "gt", value: 9 } },
      ],
    });
  });

  test("date preset → gte + lt; bare date isNull stays a single cond", () => {
    const preset = compileFilters({
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
    expect(preset?.type).toBe("and");

    const isNull = compileFilters({
      spec,
      filters: [{ field: "createdAt", filter: { kind: "date", operator: "isNull" } }],
    }).where;
    expect(isNull).toEqual({ type: "cond", cond: { field: "createdAt", op: "isNull" } });
  });

  test("a date preset without resolveDate throws", () => {
    expect(() =>
      compileFilters({
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

  test("compileFilterNode handles and/or/not and drops empty branches", () => {
    const node: FilterNode = {
      type: "and",
      nodes: [
        { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "a" } },
        {
          type: "not",
          node: {
            type: "or",
            nodes: [
              {
                type: "column",
                field: "amount",
                filter: { kind: "number", operator: "gt", value: 5 },
              },
              {
                type: "column",
                field: "ghost",
                filter: { kind: "text", operator: "eq", value: "z" },
              }, // dropped
            ],
          },
        },
      ],
    };

    expect(compileFilterNode({ spec, node }).where).toEqual({
      type: "and",
      nodes: [
        { type: "cond", cond: { field: "name", op: "eq", value: "a" } },
        {
          type: "not",
          node: {
            type: "or",
            nodes: [{ type: "cond", cond: { field: "amount", op: "gt", value: 5 } }],
          },
        },
      ],
    });

    expect(compileFilters({ spec, filters: [] }).where).toBeNull();
  });
});

// A small all-kinds filter list reused across adapters.
const filters: ColumnFilter[] = [
  { field: "name", filter: { kind: "text", operator: "contains", value: "ab" } },
  { field: "amount", filter: { kind: "number", operator: "between", from: 1, to: 9 } },
];

// ── mongo ─────────────────────────────────────────────────────────────────

describe("mongo adapter", () => {
  const spec = {
    name: mongo.textField({ path: "name" }),
    amount: mongo.numberField({ path: "amount" }),
    status: mongo.enumField({ path: "status" }),
    tags: mongo.arrayField({ path: "tags" }),
    deletedAt: mongo.dateField({ path: "deletedAt" }),
  };
  const one = (f: ColumnFilter) => {
    const { filter } = mongo.buildFilter({ spec, filters: [f] });
    const key = Object.keys((filter as Record<string, unknown>) ?? {})[0] ?? "";

    return (filter as Record<string, unknown>)?.[key];
  };

  test("scalar + ne ops", () => {
    expect(one({ field: "amount", filter: { kind: "number", operator: "ne", value: 3 } })).toEqual({
      $ne: 3,
    });
    expect(one({ field: "amount", filter: { kind: "number", operator: "lt", value: 3 } })).toEqual({
      $lt: 3,
    });
    expect(one({ field: "amount", filter: { kind: "number", operator: "gte", value: 3 } })).toEqual(
      { $gte: 3 },
    );
  });

  test("text ops → $regex (contains/startsWith/endsWith) + like→regex", () => {
    expect(
      one({ field: "name", filter: { kind: "text", operator: "startsWith", value: "a" } }),
    ).toEqual({ $regex: "^a", $options: "i" });
    expect(
      one({ field: "name", filter: { kind: "text", operator: "endsWith", value: "a" } }),
    ).toEqual({ $regex: "a$", $options: "i" });
    expect(
      one({ field: "name", filter: { kind: "text", operator: "ilike", value: "a%b_" } }),
    ).toEqual({ $regex: "^a.*b.$", $options: "i" });
    expect(
      one({ field: "name", filter: { kind: "text", operator: "notIlike", value: "a%" } }),
    ).toEqual({ $not: { $regex: "^a.*$", $options: "i" } });
  });

  test("set / array / null ops", () => {
    expect(
      one({ field: "status", filter: { kind: "enum", operator: "notInArray", values: ["x"] } }),
    ).toEqual({ $nin: ["x"] });
    expect(
      one({ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["x"] } }),
    ).toEqual({ $in: ["x"] });
    expect(one({ field: "deletedAt", filter: { kind: "date", operator: "isNotNull" } })).toEqual({
      $ne: null,
    });
  });

  test("contains + between under $and (between = half-open $gte/$lte)", () => {
    expect(mongo.buildFilter({ spec, filters }).filter).toEqual({
      $and: [
        { name: { $regex: "ab", $options: "i" } },
        { $and: [{ amount: { $gte: 1 } }, { amount: { $lte: 9 } }] },
      ],
    });
  });

  test("buildFilterNode renders $or / $nor (not)", () => {
    const { filter } = mongo.buildFilterNode({
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

    expect(filter).toEqual({ $nor: [{ $or: [{ name: { $eq: "a" } }, { amount: { $gt: 5 } }] }] });
  });

  test("arrayContained → $expr + $setIsSubset (field ⊆ values)", () => {
    const { filter } = mongo.buildFilter({
      spec,
      filters: [
        {
          field: "tags",
          filter: { kind: "array", operator: "arrayContained", values: ["x", "y"] },
        },
      ],
    });

    expect(filter).toEqual({ $expr: { $setIsSubset: ["$tags", ["x", "y"]] } });
  });
});

// ── prisma ──────────────────────────────────────────────────────────────────

describe("prisma adapter", () => {
  const spec = {
    name: prisma.textField({ field: "name" }),
    amount: prisma.numberField({ field: "amount" }),
    tags: prisma.arrayField({ field: "tags" }),
  };
  const one = (f: ColumnFilter) => {
    const { where } = prisma.buildWhere({ spec, filters: [f] });
    const key = Object.keys((where as Record<string, unknown>) ?? {})[0] ?? "";

    return (where as Record<string, unknown>)?.[key];
  };

  test("scalar + set + array + null ops", () => {
    expect(one({ field: "amount", filter: { kind: "number", operator: "ne", value: 3 } })).toEqual({
      not: 3,
    });
    expect(one({ field: "amount", filter: { kind: "number", operator: "lte", value: 3 } })).toEqual(
      { lte: 3 },
    );
    expect(
      one({ field: "amount", filter: { kind: "number", operator: "inArray", values: [1] } }),
    ).toEqual({ in: [1] });
    expect(
      one({ field: "amount", filter: { kind: "number", operator: "notInArray", values: [1] } }),
    ).toEqual({ notIn: [1] });
    expect(
      one({ field: "tags", filter: { kind: "array", operator: "arrayContains", values: ["x"] } }),
    ).toEqual({ hasEvery: ["x"] });
    expect(
      one({ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["x"] } }),
    ).toEqual({ hasSome: ["x"] });
    expect(one({ field: "amount", filter: { kind: "number", operator: "isNull" } })).toEqual({
      equals: null,
    });
    expect(one({ field: "amount", filter: { kind: "number", operator: "isNotNull" } })).toEqual({
      not: null,
    });
  });

  test("reducible like/ilike/notIlike patterns map to contains/startsWith/endsWith", () => {
    expect(
      one({ field: "name", filter: { kind: "text", operator: "ilike", value: "%a%" } }),
    ).toEqual({ contains: "a", mode: "insensitive" });
    expect(
      one({ field: "name", filter: { kind: "text", operator: "ilike", value: "a%" } }),
    ).toEqual({ startsWith: "a", mode: "insensitive" });
    expect(
      one({ field: "name", filter: { kind: "text", operator: "ilike", value: "%a" } }),
    ).toEqual({ endsWith: "a", mode: "insensitive" });
    expect(
      one({ field: "name", filter: { kind: "text", operator: "like", value: "%a%" } }),
    ).toEqual({ contains: "a" }); // case-sensitive
    expect(
      one({ field: "name", filter: { kind: "text", operator: "notIlike", value: "%a%" } }),
    ).toEqual({ not: { contains: "a", mode: "insensitive" } });
  });

  test("contains + between under AND (half-open gte/lte)", () => {
    expect(prisma.buildWhere({ spec, filters }).where).toEqual({
      AND: [
        { name: { contains: "ab", mode: "insensitive" } },
        { AND: [{ amount: { gte: 1 } }, { amount: { lte: 9 } }] },
      ],
    });
  });

  test("buildFilterNode renders OR / NOT", () => {
    const { where } = prisma.buildFilterNode({
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

    expect(where).toEqual({ NOT: { OR: [{ name: { equals: "a" } }, { amount: { gt: 5 } }] } });
  });

  test("irreducible like (internal wildcard / underscore) and arrayContained throw", () => {
    expect(() =>
      prisma.buildWhere({
        spec,
        filters: [{ field: "name", filter: { kind: "text", operator: "like", value: "a%b" } }],
      }),
    ).toThrow();
    expect(() =>
      prisma.buildWhere({
        spec,
        filters: [{ field: "name", filter: { kind: "text", operator: "ilike", value: "a_b" } }],
      }),
    ).toThrow();
    expect(() =>
      prisma.buildWhere({
        spec,
        filters: [
          { field: "tags", filter: { kind: "array", operator: "arrayContained", values: ["x"] } },
        ],
      }),
    ).toThrow();
  });
});

// ── knex (raw SQL) ────────────────────────────────────────────────────────

describe("knex adapter", () => {
  const spec = {
    name: knex.textField({ column: "name" }),
    amount: knex.numberField({ column: "amount" }),
    status: knex.enumField({ column: "status" }),
    tags: knex.arrayField({ column: "tags" }),
  };
  const sqlOf = (f: ColumnFilter) => knex.buildWhereSql({ spec, filters: [f] });

  test("scalar / text / set / array / null → parameterized SQL", () => {
    expect(
      sqlOf({ field: "amount", filter: { kind: "number", operator: "gte", value: 3 } }),
    ).toEqual({ sql: '"amount" >= ?', bindings: [3] });
    expect(
      sqlOf({ field: "name", filter: { kind: "text", operator: "ilike", value: "a%" } }),
    ).toEqual({ sql: '"name" ILIKE ?', bindings: ["a%"] });
    expect(
      sqlOf({ field: "name", filter: { kind: "text", operator: "like", value: "a%" } }),
    ).toEqual({ sql: '"name" LIKE ?', bindings: ["a%"] });
    expect(
      sqlOf({ field: "name", filter: { kind: "text", operator: "notIlike", value: "a%" } }),
    ).toEqual({ sql: '"name" NOT ILIKE ?', bindings: ["a%"] });
    expect(
      sqlOf({ field: "status", filter: { kind: "enum", operator: "inArray", values: ["a", "b"] } }),
    ).toEqual({ sql: '"status" IN (?, ?)', bindings: ["a", "b"] });
    expect(
      sqlOf({ field: "tags", filter: { kind: "array", operator: "arrayContains", values: ["x"] } }),
    ).toEqual({ sql: '"tags" @> ?', bindings: [["x"]] });
    expect(sqlOf({ field: "amount", filter: { kind: "number", operator: "isNull" } })).toEqual({
      sql: '"amount" IS NULL',
      bindings: [],
    });
  });

  test("between → half-open; whole AND list", () => {
    expect(knex.buildWhereSql({ spec, filters })).toEqual({
      sql: '("name" ILIKE ? AND ("amount" >= ? AND "amount" <= ?))',
      bindings: ["%ab%", 1, 9],
    });
  });

  test("buildFilterNodeSql renders NOT ( ... OR ... )", () => {
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

    expect(knex.buildFilterNodeSql({ spec, node })).toEqual({
      sql: 'NOT (("name" = ? OR "amount" > ?))',
      bindings: ["a", 5],
    });
  });

  test("applyFiltersToKnex calls whereRaw with the fragment", () => {
    const calls: { sql: string; bindings: unknown[] }[] = [];
    const query = {
      whereRaw(sql: string, bindings?: unknown[]) {
        calls.push({ sql, bindings: bindings ?? [] });

        return this;
      },
    };
    knex.applyFiltersToKnex(query, { spec, filters });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.bindings).toEqual(["%ab%", 1, 9]);
  });

  test("rejects an invalid identifier", () => {
    expect(() =>
      knex.buildWhereSql({
        spec: { name: knex.textField({ column: "name; drop table" }) },
        filters: [{ field: "name", filter: { kind: "text", operator: "eq", value: "x" } }],
      }),
    ).toThrow();
  });

  test("table.column identifiers are quoted per part", () => {
    expect(
      knex.buildWhereSql({
        spec: { name: knex.textField({ column: "t.name" }) },
        filters: [{ field: "name", filter: { kind: "text", operator: "eq", value: "x" } }],
      }),
    ).toEqual({ sql: '"t"."name" = ?', bindings: ["x"] });
  });
});

// ── kysely (compiled SQL) ───────────────────────────────────────────────────

const kdb = new Kysely<Record<string, never>>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

describe("kysely adapter", () => {
  const spec = {
    name: kysely.textField({ column: "name" }),
    amount: kysely.numberField({ column: "amount" }),
    tags: kysely.arrayField({ column: "tags" }),
  };
  const compiled = (f: ColumnFilter) => {
    const { where } = kysely.buildWhere({ spec, filters: [f] });

    return where ? where.compile(kdb) : null;
  };

  test("scalar / text / array / null ops compile to PG SQL", () => {
    expect(
      compiled({ field: "amount", filter: { kind: "number", operator: "lte", value: 3 } })?.sql,
    ).toContain("<=");
    expect(
      compiled({ field: "name", filter: { kind: "text", operator: "contains", value: "a" } })?.sql,
    ).toContain("ilike");
    expect(
      compiled({
        field: "tags",
        filter: { kind: "array", operator: "arrayContains", values: ["x"] },
      })?.sql,
    ).toContain("@>");
    expect(
      compiled({ field: "amount", filter: { kind: "number", operator: "isNull" } })?.sql,
    ).toContain("is null");
  });

  test("between (half-open) + and/or/not tree compile", () => {
    const all = kysely.buildWhere({ spec, filters }).where?.compile(kdb);
    expect(all?.sql).toContain(">=");
    expect(all?.sql).toContain("<=");
    expect(all?.sql).not.toContain("between");

    const { where } = kysely.buildFilterNode({
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
    const sql = where?.compile(kdb).sql.toLowerCase() ?? "";
    expect(sql).toContain(" or ");
    expect(sql).toContain("not ");
  });

  test("buildOrderBy renders allow-listed asc/desc expressions", () => {
    const { orderBy } = kysely.buildOrderBy({
      sort: [
        { field: "amount", dir: "desc" },
        { field: "ghost", dir: "asc" }, // dropped
      ],
      columns: { amount: "amount" },
    });

    expect(orderBy).toHaveLength(1);
    expect(orderBy[0]?.compile(kdb).sql.toLowerCase()).toContain("desc");
  });
});

// ── dialect-aware array ops + ilike (knex / kysely) ─────────────────────────

const arrayOps = ["arrayContains", "arrayContained", "arrayOverlaps"] as const;

describe("knex dialect (array ops + ilike per dialect)", () => {
  const spec = {
    name: knex.textField({ column: "name" }),
    tags: knex.arrayField({ column: "tags" }),
  };
  const arrayCond = (op: (typeof arrayOps)[number], dialect: knex.SqlDialect) =>
    knex.buildWhereSql({
      spec,
      filters: [{ field: "tags", filter: { kind: "array", operator: op, values: ["x"] } }],
      dialect,
    });

  test("postgres (default) uses native @>/<@/&& with the array bound directly", () => {
    expect(arrayCond("arrayContains", "postgres")).toEqual({
      sql: '"tags" @> ?',
      bindings: [["x"]],
    });
    expect(arrayCond("arrayContained", "postgres")).toEqual({
      sql: '"tags" <@ ?',
      bindings: [["x"]],
    });
    expect(arrayCond("arrayOverlaps", "postgres")).toEqual({
      sql: '"tags" && ?',
      bindings: [["x"]],
    });
  });

  test("mysql uses JSON_CONTAINS / JSON_OVERLAPS with a bound JSON candidate", () => {
    expect(arrayCond("arrayContains", "mysql")).toEqual({
      sql: 'JSON_CONTAINS("tags", ?)',
      bindings: ['["x"]'],
    });
    expect(arrayCond("arrayContained", "mysql")).toEqual({
      sql: 'JSON_CONTAINS(?, "tags")',
      bindings: ['["x"]'],
    });
    expect(arrayCond("arrayOverlaps", "mysql")).toEqual({
      sql: 'JSON_OVERLAPS("tags", ?)',
      bindings: ['["x"]'],
    });
  });

  test("sqlite uses json_each(…) EXISTS / NOT EXISTS subqueries", () => {
    expect(arrayCond("arrayContains", "sqlite")).toEqual({
      sql: 'NOT EXISTS (SELECT 1 FROM json_each(?) je WHERE je.value NOT IN (SELECT value FROM json_each("tags")))',
      bindings: ['["x"]'],
    });
    expect(arrayCond("arrayContained", "sqlite")).toEqual({
      sql: 'NOT EXISTS (SELECT 1 FROM json_each("tags") je WHERE je.value NOT IN (SELECT value FROM json_each(?)))',
      bindings: ['["x"]'],
    });
    expect(arrayCond("arrayOverlaps", "sqlite")).toEqual({
      sql: 'EXISTS (SELECT 1 FROM json_each("tags") je WHERE je.value IN (SELECT value FROM json_each(?)))',
      bindings: ['["x"]'],
    });
  });

  test("ilike folds to LIKE on mysql/sqlite, stays ILIKE on postgres", () => {
    const contains = (dialect: knex.SqlDialect) =>
      knex.buildWhereSql({
        spec,
        filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "a" } }],
        dialect,
      });
    const notIlike = (dialect: knex.SqlDialect) =>
      knex.buildWhereSql({
        spec,
        filters: [{ field: "name", filter: { kind: "text", operator: "notIlike", value: "a%" } }],
        dialect,
      });

    expect(contains("postgres")).toEqual({ sql: '"name" ILIKE ?', bindings: ["%a%"] });
    expect(contains("mysql")).toEqual({ sql: '"name" LIKE ?', bindings: ["%a%"] });
    expect(contains("sqlite")).toEqual({ sql: '"name" LIKE ?', bindings: ["%a%"] });
    expect(notIlike("postgres")).toEqual({ sql: '"name" NOT ILIKE ?', bindings: ["a%"] });
    expect(notIlike("mysql")).toEqual({ sql: '"name" NOT LIKE ?', bindings: ["a%"] });
  });
});

describe("kysely dialect (array ops + ilike per dialect)", () => {
  const spec = {
    name: kysely.textField({ column: "name" }),
    tags: kysely.arrayField({ column: "tags" }),
  };
  const arraySql = (op: (typeof arrayOps)[number], dialect: kysely.SqlDialect) =>
    kysely
      .buildWhere({
        spec,
        filters: [{ field: "tags", filter: { kind: "array", operator: op, values: ["x"] } }],
        dialect,
      })
      .where?.compile(kdb)
      .sql.toLowerCase() ?? "";

  test("postgres (default) compiles native set operators", () => {
    expect(arraySql("arrayContains", "postgres")).toContain("@>");
    expect(arraySql("arrayContained", "postgres")).toContain("<@");
    expect(arraySql("arrayOverlaps", "postgres")).toContain("&&");
  });

  test("mysql compiles JSON_CONTAINS / JSON_OVERLAPS", () => {
    expect(arraySql("arrayContains", "mysql")).toContain("json_contains(");
    expect(arraySql("arrayContained", "mysql")).toContain("json_contains(");
    expect(arraySql("arrayOverlaps", "mysql")).toContain("json_overlaps(");
  });

  test("sqlite compiles json_each(…) EXISTS / NOT EXISTS subqueries", () => {
    expect(arraySql("arrayContains", "sqlite")).toContain("not exists");
    expect(arraySql("arrayContains", "sqlite")).toContain("json_each(");
    expect(arraySql("arrayContained", "sqlite")).toContain("not exists");
    expect(arraySql("arrayOverlaps", "sqlite")).toMatch(/(?<!not )exists/);
  });

  test("ilike folds to LIKE on mysql/sqlite, stays ILIKE on postgres", () => {
    const contains = (dialect: kysely.SqlDialect) =>
      kysely
        .buildWhere({
          spec,
          filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "a" } }],
          dialect,
        })
        .where?.compile(kdb)
        .sql.toLowerCase() ?? "";

    expect(contains("postgres")).toContain("ilike");
    expect(contains("mysql")).toContain("like");
    expect(contains("mysql")).not.toContain("ilike");
    expect(contains("sqlite")).not.toContain("ilike");
  });
});
