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
