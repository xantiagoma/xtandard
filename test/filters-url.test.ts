import { describe, expect, test } from "vitest";

import type { ColumnFilter, FieldKindSpec, FilterNode } from "../src/filters/types.ts";
import {
  compactFilterNode,
  compactFilters,
  createFilterUrlCodec,
  expandFilterNode,
  expandFilters,
  OPERATOR_CODE,
  operatorFromCode,
  UNIT_CODE,
  unitFromCode,
} from "../src/filters/url.ts";

const kinds: FieldKindSpec = {
  title: "text",
  status: "enum",
  priority: "number",
  active: "boolean",
  tags: "array",
  createdAt: "date",
};

// The exact tree behind the screenshot URL.
const tree: FilterNode = {
  type: "or",
  nodes: [
    {
      type: "column",
      field: "title",
      filter: { kind: "text", operator: "contains", value: "inves" },
    },
    {
      type: "column",
      field: "status",
      filter: { kind: "enum", operator: "inArray", values: ["todo", "in_progress"] },
    },
    {
      type: "and",
      nodes: [
        {
          type: "column",
          field: "priority",
          filter: { kind: "number", operator: "eq", value: 1 },
        },
      ],
    },
  ],
};

describe("compact URL codec — code maps", () => {
  test("every operator code round-trips (no drift between OPERATOR_CODE and operatorFromCode)", () => {
    for (const [op, code] of Object.entries(OPERATOR_CODE)) {
      expect(operatorFromCode(code)).toBe(op);
    }
    expect(operatorFromCode("nope")).toBeNull();
  });

  test("every unit code round-trips", () => {
    for (const [unit, code] of Object.entries(UNIT_CODE)) {
      expect(unitFromCode(code)).toBe(unit);
    }
    expect(unitFromCode("nope")).toBeNull();
  });
});

describe("compact URL codec — encode shape", () => {
  test("flattens filter, drops kind/type, single-key connectives, short operators", () => {
    expect(compactFilterNode({ node: tree }).compact).toEqual({
      or: [
        { f: "title", o: "ct", v: "inves" },
        { f: "status", o: "iA", vs: ["todo", "in_progress"] },
        { and: [{ f: "priority", o: "eq", v: 1 }] },
      ],
    });
  });
});

describe("compact URL codec — round-trips (encode → decode = identity)", () => {
  test("the full or/and tree survives", () => {
    const { compact } = compactFilterNode({ node: tree });
    expect(expandFilterNode({ compact, kinds }).node).toEqual(tree);
  });

  test("each kind / arg shape round-trips", () => {
    const leaves: ColumnFilter[] = [
      { field: "title", filter: { kind: "text", operator: "startsWith", value: "a" } },
      { field: "title", filter: { kind: "text", operator: "isNull" } },
      { field: "priority", filter: { kind: "number", operator: "between", from: 1, to: 9 } },
      { field: "priority", filter: { kind: "number", operator: "inArray", values: [1, 2] } },
      { field: "status", filter: { kind: "enum", operator: "ne", value: "todo" } },
      { field: "active", filter: { kind: "boolean", operator: "eq", value: true } },
      { field: "tags", filter: { kind: "array", operator: "arrayContains", values: ["x", "y"] } },
      { field: "tags", filter: { kind: "array", operator: "arrayContained", values: [1, 2] } },
      {
        field: "createdAt",
        filter: {
          kind: "date",
          operator: "between",
          unit: "month",
          timeZone: "America/Los_Angeles",
          anchor: "2026-02-01T00:00:00",
          end: "2026-04-01T00:00:00",
          weekStartsOn: 1,
        },
      },
      { field: "createdAt", filter: { kind: "date", operator: "isNotNull" } },
    ];

    const { compact } = compactFilters({ filters: leaves });
    expect(expandFilters({ compact, kinds }).filters).toEqual(leaves);
  });

  test("a not(...) node round-trips", () => {
    const node: FilterNode = {
      type: "not",
      node: {
        type: "column",
        field: "active",
        filter: { kind: "boolean", operator: "eq", value: false },
      },
    };
    const { compact } = compactFilterNode({ node });
    expect(expandFilterNode({ compact, kinds }).node).toEqual(node);
  });
});

describe("compact URL codec — decode is defensive (spec-aware)", () => {
  test("drops fields not in the kinds allow-list", () => {
    const { filters } = expandFilters({
      compact: [
        { f: "title", o: "ct", v: "a" },
        { f: "secret", o: "eq", v: "x" }, // not in `kinds`
      ],
      kinds,
    });
    expect(filters).toEqual([
      { field: "title", filter: { kind: "text", operator: "contains", value: "a" } },
    ]);
  });

  test("drops unknown operator codes and wrong-typed args", () => {
    expect(expandFilters({ compact: [{ f: "title", o: "zzz", v: "a" }], kinds }).filters).toEqual(
      [],
    );
    // number scalar with a string value → dropped
    expect(
      expandFilters({ compact: [{ f: "priority", o: "eq", v: "nope" }], kinds }).filters,
    ).toEqual([]);
    // between missing `to` → dropped
    expect(expandFilters({ compact: [{ f: "priority", o: "bt", fr: 1 }], kinds }).filters).toEqual(
      [],
    );
  });

  test("set values are type-filtered to the kind", () => {
    // enum inArray keeps only strings
    expect(
      expandFilters({ compact: [{ f: "status", o: "iA", vs: ["todo", 3, "done"] }], kinds })
        .filters,
    ).toEqual([
      { field: "status", filter: { kind: "enum", operator: "inArray", values: ["todo", "done"] } },
    ]);
  });

  test("a connective whose children all drop becomes null", () => {
    expect(
      expandFilterNode({ compact: { or: [{ f: "ghost", o: "eq", v: "x" }] }, kinds }).node,
    ).toBeNull();
    expect(expandFilterNode({ compact: "garbage", kinds }).node).toBeNull();
  });
});

describe("compact URL codec — createFilterUrlCodec", () => {
  test("binds kinds for encode/decode pairs", () => {
    const codec = createFilterUrlCodec({ kinds });
    const encoded = codec.encodeNode(tree);
    expect(codec.decodeNode(encoded)).toEqual(tree);

    const flat: ColumnFilter[] = [
      { field: "title", filter: { kind: "text", operator: "eq", value: "a" } },
    ];
    expect(codec.decodeFilters(codec.encodeFilters(flat))).toEqual(flat);
  });
});
