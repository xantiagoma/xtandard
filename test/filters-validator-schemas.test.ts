import { describe, expect, test } from "vitest";
import { Schema } from "effect";

import type { ColumnFilter } from "../src/filters/types.ts";
import * as zod from "../src/filters/schemas-zod.ts";
import * as ark from "../src/filters/schemas-arktype.ts";
import * as effect from "../src/filters/schemas-effect.ts";

const valid: ColumnFilter[] = [
  { field: "title", filter: { kind: "text", operator: "contains", value: "x" } },
  { field: "status", filter: { kind: "enum", operator: "inArray", values: ["todo", "done"] } },
  {
    field: "createdAt",
    filter: {
      kind: "date",
      operator: "is",
      unit: "month",
      timeZone: "America/Los_Angeles",
      anchor: "2026-02-01T00:00:00",
    },
  },
];

// unknown operator for the kind
const badOperator = [{ field: "title", filter: { kind: "text", operator: "nope", value: "x" } }];
// invalid IANA time zone (the refinement must reject)
const badTimeZone = [
  {
    field: "createdAt",
    filter: {
      kind: "date",
      operator: "is",
      unit: "month",
      timeZone: "Not/AZone",
      anchor: "2026-02-01T00:00:00",
    },
  },
];

describe("ready-made schemas accept valid + reject invalid at runtime", () => {
  test("zod", () => {
    expect(zod.FiltersRequestSchema.parse(valid)).toEqual(valid);
    expect(zod.FiltersRequestSchema.safeParse(badOperator).success).toBe(false);
    expect(zod.FiltersRequestSchema.safeParse(badTimeZone).success).toBe(false);
  });

  test("effect", () => {
    const decode = Schema.decodeUnknownSync(effect.FiltersRequestSchema);
    expect(decode(valid)).toEqual(valid);
    expect(() => decode(badOperator)).toThrow();
    expect(() => decode(badTimeZone)).toThrow();
  });

  test("arktype", () => {
    expect(ark.FiltersRequestSchema.assert(valid)).toEqual(valid);
    expect(() => ark.FiltersRequestSchema.assert(badOperator)).toThrow();
    expect(() => ark.FiltersRequestSchema.assert(badTimeZone)).toThrow();
  });
});
