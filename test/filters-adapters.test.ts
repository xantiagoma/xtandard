import { describe, expect, test } from "vitest";

import type { ColumnFilter, DatePreset } from "../src/filters/types.ts";
import { compileFilters } from "../src/filters/compile.ts";
import * as mongo from "../src/filters/mongo.ts";
import * as prisma from "../src/filters/prisma.ts";
import * as knex from "../src/filters/knex.ts";
import * as kysely from "../src/filters/kysely.ts";

const resolveDate = ({ value }: { value: DatePreset }) => {
  const start = new Date(`${value.anchor}Z`);
  const end = value.end ? new Date(`${value.end}Z`) : new Date(start.getTime() + 86_400_000);

  return { start, end };
};

describe("compileFilters (portable core)", () => {
  const spec = { name: "text", amount: "number", createdAt: "date" } as const;

  test("keeps text-match ops semantic and drops non-allow-listed fields", () => {
    const { where } = compileFilters({
      spec,
      filters: [
        { field: "name", filter: { kind: "text", operator: "contains", value: "a%b" } },
        { field: "secret", filter: { kind: "text", operator: "eq", value: "x" } }, // dropped
      ],
    });

    expect(where).toEqual({ type: "cond", cond: { field: "name", op: "contains", value: "a%b" } });
  });

  test("resolves a date preset to gte + lt", () => {
    const { where } = compileFilters({
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
    });

    expect(where?.type).toBe("and");
    if (where?.type === "and") {
      expect(where.nodes.map((n) => (n.type === "cond" ? n.cond.op : n.type))).toEqual([
        "gte",
        "lt",
      ]);
    }
  });

  test("empty / all-dropped → null", () => {
    expect(compileFilters({ spec, filters: [] }).where).toBeNull();
  });
});

const filters: ColumnFilter[] = [
  { field: "name", filter: { kind: "text", operator: "contains", value: "ab" } },
  { field: "amount", filter: { kind: "number", operator: "between", from: 1, to: 9 } },
];

describe("mongo adapter", () => {
  const spec = {
    name: mongo.textField({ path: "name" }),
    amount: mongo.numberField({ path: "amount" }),
    tags: mongo.arrayField({ path: "tags" }),
    deletedAt: mongo.dateField({ path: "deletedAt" }),
  };

  test("contains → $regex, between → $gte/$lte, under $and", () => {
    const { filter } = mongo.buildFilter({ spec, filters });

    expect(filter).toEqual({
      $and: [{ name: { $regex: "ab", $options: "i" } }, { amount: { $gte: 1, $lte: 9 } }],
    });
  });

  test("inArray → $in, isNull → $eq null", () => {
    const { filter } = mongo.buildFilter({
      spec,
      filters: [
        { field: "tags", filter: { kind: "array", operator: "arrayContains", values: ["x", "y"] } },
        { field: "deletedAt", filter: { kind: "date", operator: "isNull" } },
      ],
    });

    expect(filter).toEqual({
      $and: [{ tags: { $all: ["x", "y"] } }, { deletedAt: { $eq: null } }],
    });
  });
});

describe("prisma adapter", () => {
  const spec = {
    name: prisma.textField({ field: "name" }),
    amount: prisma.numberField({ field: "amount" }),
  };

  test("contains → insensitive mode, between → gte/lte, under AND", () => {
    const { where } = prisma.buildWhere({ spec, filters });

    expect(where).toEqual({
      AND: [{ name: { contains: "ab", mode: "insensitive" } }, { amount: { gte: 1, lte: 9 } }],
    });
  });

  test("raw like throws (no Prisma equivalent)", () => {
    expect(() =>
      prisma.buildWhere({
        spec,
        filters: [{ field: "name", filter: { kind: "text", operator: "like", value: "a%" } }],
      }),
    ).toThrow();
  });
});

describe("knex adapter", () => {
  const spec = {
    name: knex.textField({ column: "name" }),
    amount: knex.numberField({ column: "amount" }),
  };

  test("renders parameterized SQL with ILIKE + BETWEEN", () => {
    const fragment = knex.buildWhereSql({ spec, filters });

    expect(fragment).not.toBeNull();
    expect(fragment?.sql).toBe('("name" ILIKE ? AND "amount" BETWEEN ? AND ?)');
    expect(fragment?.bindings).toEqual(["%ab%", 1, 9]);
  });

  test("rejects an invalid identifier", () => {
    expect(() =>
      knex.buildWhereSql({
        spec: { name: knex.textField({ column: "name; drop table" }) },
        filters: [{ field: "name", filter: { kind: "text", operator: "eq", value: "x" } }],
      }),
    ).toThrow();
  });
});

describe("kysely adapter", () => {
  const spec = { name: kysely.textField({ column: "t.name" }) };

  test("produces a defined boolean expression", () => {
    const { where } = kysely.buildWhere({
      spec,
      filters: [{ field: "name", filter: { kind: "text", operator: "eq", value: "x" } }],
    });

    expect(where).toBeDefined();
  });
});
