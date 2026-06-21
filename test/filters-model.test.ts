import { describe, expect, test } from "vitest";
import * as v from "valibot";

import { describeColumnFilter, describeFieldFilter } from "../src/filters/describe.ts";
import {
  FieldFilterSchema,
  FilterNodeSchema,
  FiltersRequestSchema,
} from "../src/filters/schemas.ts";

describe("FieldFilterSchema", () => {
  test("parses a date preset into the discriminated union", () => {
    const parsed = v.parse(FieldFilterSchema, {
      kind: "date",
      operator: "between",
      unit: "day",
      timeZone: "America/Los_Angeles",
      anchor: "2026-01-10T00:00:00",
      end: "2026-01-20T00:00:00",
    });

    expect(parsed.kind).toBe("date");
  });

  test("number scalar / range / set are distinct shapes", () => {
    expect(
      v.parse(FieldFilterSchema, { kind: "number", operator: "between", from: 1, to: 9 }),
    ).toMatchObject({ from: 1, to: 9 });
    expect(v.parse(FieldFilterSchema, { kind: "number", operator: "gte", value: 5 })).toMatchObject(
      { value: 5 },
    );
    expect(
      v.parse(FieldFilterSchema, { kind: "number", operator: "inArray", values: [1, 2] }),
    ).toMatchObject({ values: [1, 2] });
  });

  test("text matching + set + unary operators", () => {
    expect(
      v.parse(FieldFilterSchema, { kind: "text", operator: "ilike", value: "%hi%" }).kind,
    ).toBe("text");
    expect(
      v.parse(FieldFilterSchema, { kind: "text", operator: "contains", value: "hi" }).kind,
    ).toBe("text");
    expect(
      v.parse(FieldFilterSchema, { kind: "text", operator: "inArray", values: ["a"] }).kind,
    ).toBe("text");
    expect(v.parse(FieldFilterSchema, { kind: "text", operator: "isNull" }).operator).toBe(
      "isNull",
    );
  });

  test("enum / boolean / array", () => {
    expect(
      v.parse(FieldFilterSchema, { kind: "enum", operator: "inArray", values: ["running"] }).kind,
    ).toBe("enum");
    expect(v.parse(FieldFilterSchema, { kind: "boolean", operator: "ne", value: true }).kind).toBe(
      "boolean",
    );
    expect(
      v.parse(FieldFilterSchema, { kind: "array", operator: "arrayOverlaps", values: [1, 2] }).kind,
    ).toBe("array");
  });

  test("rejects an unknown kind", () => {
    expect(() =>
      v.parse(FieldFilterSchema, { kind: "color", operator: "eq", value: "red" }),
    ).toThrow();
  });

  test("rejects an operator that doesn't belong to the kind", () => {
    // `between` is not a text operator.
    expect(() =>
      v.parse(FieldFilterSchema, { kind: "text", operator: "between", from: "a", to: "b" }),
    ).toThrow();
  });

  test("rejects an invalid timezone / malformed anchor on a date preset", () => {
    expect(() =>
      v.parse(FieldFilterSchema, {
        kind: "date",
        operator: "is",
        unit: "day",
        timeZone: "Not/AZone",
        anchor: "2026-01-10T00:00:00",
      }),
    ).toThrow();
    expect(() =>
      v.parse(FieldFilterSchema, {
        kind: "date",
        operator: "is",
        unit: "day",
        timeZone: "UTC",
        anchor: "nope",
      }),
    ).toThrow();
  });
});

describe("FiltersRequestSchema", () => {
  test("parses a multi-column AND request", () => {
    const parsed = v.parse(FiltersRequestSchema, [
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
        field: "status",
        filter: { kind: "enum", operator: "inArray", values: ["running", "queued"] },
      },
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.field).toBe("createdAt");
  });
});

describe("FilterNodeSchema (and/or/not tree)", () => {
  test("parses a nested OR of two column filters under a NOT", () => {
    const parsed = v.parse(FilterNodeSchema, {
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
                field: "kind",
                filter: { kind: "enum", operator: "eq", value: "support" },
              },
              { type: "column", field: "createdAt", filter: { kind: "date", operator: "isNull" } },
            ],
          },
        },
      ],
    });

    expect(parsed.type).toBe("and");
  });
});

describe("describe", () => {
  test("labels each kind/operator", () => {
    expect(
      describeFieldFilter({ filter: { kind: "text", operator: "contains", value: "abc" } }),
    ).toBe('contains "abc"');
    expect(
      describeFieldFilter({ filter: { kind: "number", operator: "between", from: 1, to: 9 } }),
    ).toBe("between 1 – 9");
    expect(
      describeFieldFilter({ filter: { kind: "enum", operator: "inArray", values: ["a", "b"] } }),
    ).toBe("in a, b");
    expect(describeFieldFilter({ filter: { kind: "boolean", operator: "eq", value: false } })).toBe(
      "= false",
    );
    expect(describeFieldFilter({ filter: { kind: "text", operator: "isNull" } })).toBe("is empty");
  });

  test("describeColumnFilter prefixes the label", () => {
    expect(
      describeColumnFilter({
        columnFilter: { field: "name", filter: { kind: "text", operator: "eq", value: "x" } },
        label: "Name",
      }),
    ).toBe('Name = "x"');
  });

  test("date preset uses the injected describeDate; falls back to the operator label without it", () => {
    const preset = {
      kind: "date",
      operator: "is",
      unit: "day",
      timeZone: "UTC",
      anchor: "2026-02-14T00:00:00",
    } as const;

    expect(describeFieldFilter({ filter: preset, describeDate: () => "Feb 14, 2026" })).toBe(
      "Feb 14, 2026",
    );
    expect(describeFieldFilter({ filter: preset })).toBe("is"); // no describer → operator label
    expect(describeFieldFilter({ filter: { kind: "date", operator: "isNull" } })).toBe("is empty");
  });
});
