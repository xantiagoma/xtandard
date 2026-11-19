import { describe, expect, test } from "vitest";
import * as v from "valibot";
import type { z } from "zod";
import { Schema } from "effect";
import { type } from "arktype";

import type { ColumnFilter } from "../src/filters/types.ts";
import * as valibot from "../src/filters/schemas.ts";
import * as zod from "../src/filters/schemas-zod.ts";
import * as ark from "../src/filters/schemas-arktype.ts";
import * as effect from "../src/filters/schemas-effect.ts";

// The four ready-made schema subpaths export the same 13 names; every one of
// them is exercised against every library below. Invalid inputs go through
// each library's NON-throwing check (`safeParse` / `is` / `instanceof
// type.errors`), so a schema that crashes (e.g. a `TypeError` from a bad
// recursive alias) fails the test instead of passing as "rejected".
type SchemaName = keyof typeof valibot;

type Lib = {
  /** Parse or throw a validation error. */
  parse: (name: SchemaName, input: unknown) => unknown;
  /** `true` when the input is valid; must not throw. */
  accepts: (name: SchemaName, input: unknown) => boolean;
};

type AnyEffectSchema = Schema.Schema<unknown, unknown, never>;
type AnyArkType = (input: unknown) => unknown;

const libs: Record<"valibot" | "zod" | "effect" | "arktype", Lib> = {
  valibot: {
    parse: (name, input) => v.parse(valibot[name] as v.GenericSchema, input),
    accepts: (name, input) => v.safeParse(valibot[name] as v.GenericSchema, input).success,
  },
  zod: {
    parse: (name, input) => (zod[name] as z.ZodType).parse(input),
    accepts: (name, input) => (zod[name] as z.ZodType).safeParse(input).success,
  },
  effect: {
    parse: (name, input) => Schema.decodeUnknownSync(effect[name] as AnyEffectSchema)(input),
    accepts: (name, input) => Schema.is(effect[name] as AnyEffectSchema)(input),
  },
  arktype: {
    parse: (name, input) => {
      const out = (ark[name] as unknown as AnyArkType)(input);
      if (out instanceof type.errors) throw new Error(out.summary);
      return out;
    },
    accepts: (name, input) => !((ark[name] as unknown as AnyArkType)(input) instanceof type.errors),
  },
};

const preset = {
  kind: "date",
  operator: "is",
  unit: "month",
  timeZone: "America/Los_Angeles",
  anchor: "2026-02-01T00:00:00",
} as const;

const leaf = (field: string, filter: unknown) => ({ type: "column", field, filter });
const openLeaf = leaf("status", { kind: "enum", operator: "eq", value: "open" });

const validFilters: ColumnFilter[] = [
  { field: "title", filter: { kind: "text", operator: "contains", value: "x" } },
  { field: "status", filter: { kind: "enum", operator: "inArray", values: ["todo", "done"] } },
  { field: "createdAt", filter: preset },
];

/** Per schema: inputs every library must accept unchanged, and inputs every
 * library must reject. */
const fixtures: Record<SchemaName, { valid: unknown[]; invalid: unknown[] }> = {
  TextFilterSchema: {
    valid: [
      { kind: "text", operator: "contains", value: "ada" },
      { kind: "text", operator: "inArray", values: ["a", "b"] },
      { kind: "text", operator: "isNull" },
    ],
    invalid: [
      { kind: "text", operator: "lt", value: "a" },
      { kind: "text", operator: "contains", value: 1 },
      { kind: "text", operator: "inArray", values: ["a", 1] },
      { kind: "number", operator: "eq", value: 1 },
    ],
  },
  NumberFilterSchema: {
    valid: [
      { kind: "number", operator: "gte", value: 10 },
      { kind: "number", operator: "between", from: 1, to: 9 },
      { kind: "number", operator: "notInArray", values: [1, 2] },
      { kind: "number", operator: "isNotNull" },
    ],
    invalid: [
      { kind: "number", operator: "between", from: 10 },
      { kind: "number", operator: "contains", value: "1" },
      { kind: "number", operator: "inArray", values: ["1"] },
      { kind: "number", operator: "eq", value: "1" },
    ],
  },
  EnumFilterSchema: {
    valid: [
      { kind: "enum", operator: "eq", value: "open" },
      { kind: "enum", operator: "inArray", values: ["open", "done"] },
      { kind: "enum", operator: "isNull" },
    ],
    invalid: [
      { kind: "enum", operator: "contains", value: "op" },
      { kind: "enum", operator: "eq", value: 1 },
      { kind: "enum", operator: "eq" },
    ],
  },
  BooleanFilterSchema: {
    valid: [
      { kind: "boolean", operator: "eq", value: true },
      { kind: "boolean", operator: "ne", value: false },
      { kind: "boolean", operator: "isNull" },
    ],
    invalid: [
      { kind: "boolean", operator: "eq", value: "true" },
      { kind: "boolean", operator: "inArray", values: [true] },
    ],
  },
  DatePresetSchema: {
    valid: [
      preset,
      {
        ...preset,
        operator: "between",
        unit: "day",
        end: "2026-02-20T00:00:00",
        weekStartsOn: 1,
      },
    ],
    invalid: [
      { ...preset, timeZone: "Mars/Olympus" },
      { ...preset, anchor: "tomorrow" },
      { ...preset, anchor: "2026-02-01T00:00:00Z" }, // an instant, not a wall-clock time
      { ...preset, end: "nope" },
      { ...preset, weekStartsOn: 7 },
      { ...preset, weekStartsOn: 1.5 },
      { ...preset, unit: "fortnight" },
      { ...preset, operator: "eq" },
    ],
  },
  DateFilterSchema: {
    valid: [preset, { kind: "date", operator: "isNull" }],
    invalid: [{ kind: "date", operator: "eq", value: "2026-02-01" }, { kind: "date" }],
  },
  ArrayFilterSchema: {
    valid: [
      { kind: "array", operator: "arrayOverlaps", values: ["a", 1] },
      { kind: "array", operator: "arrayContains", values: ["a"] },
      { kind: "array", operator: "isNull" },
    ],
    invalid: [
      { kind: "array", operator: "inArray", values: ["a"] },
      { kind: "array", operator: "arrayContains", values: [true] },
    ],
  },
  FieldFilterSchema: {
    valid: [
      { kind: "text", operator: "eq", value: "a" },
      { kind: "number", operator: "between", from: 1, to: 2 },
      { kind: "enum", operator: "ne", value: "x" },
      { kind: "boolean", operator: "eq", value: false },
      preset,
      { kind: "array", operator: "arrayContained", values: [1] },
    ],
    invalid: [
      { kind: "number", operator: "contains", value: "1" },
      { kind: "bogus", operator: "eq", value: 1 },
      "text",
    ],
  },
  ColumnFilterSchema: {
    valid: validFilters,
    invalid: [
      { field: "status", filter: { kind: "enum", operator: "eq" } },
      { filter: { kind: "enum", operator: "eq", value: "open" } },
      { field: 1, filter: { kind: "enum", operator: "eq", value: "open" } },
    ],
  },
  FiltersRequestSchema: {
    valid: [validFilters, []],
    invalid: [
      [{ field: "name" }],
      // unknown operator for the kind
      [{ field: "title", filter: { kind: "text", operator: "nope", value: "x" } }],
      // invalid IANA time zone (the refinement must reject)
      [{ field: "createdAt", filter: { ...preset, timeZone: "Not/AZone" } }],
      { field: "title", filter: { kind: "text", operator: "isNull" } },
    ],
  },
  FilterNodeSchema: {
    valid: [
      openLeaf,
      { type: "and", nodes: [] },
      { type: "not", node: openLeaf },
      {
        type: "and",
        nodes: [
          openLeaf,
          {
            type: "not",
            node: {
              type: "or",
              nodes: [
                leaf("kind", { kind: "enum", operator: "eq", value: "support" }),
                leaf("createdAt", { kind: "date", operator: "isNull" }),
                leaf("createdAt", preset),
              ],
            },
          },
        ],
      },
    ],
    invalid: [
      { type: "and", nodes: [{ type: "x" }] },
      { type: "not" },
      { type: "xor", nodes: [] },
      leaf("name", { kind: "text", operator: "lt", value: "a" }),
      // an invalid leaf three levels down
      {
        type: "or",
        nodes: [{ type: "not", node: { type: "and", nodes: [leaf("n", { kind: "number" })] } }],
      },
    ],
  },
  SortItemSchema: {
    valid: [
      { field: "createdAt", dir: "desc" },
      { field: "name", dir: "asc" },
    ],
    invalid: [
      { field: "createdAt", dir: "down" },
      { field: "createdAt", dir: "ASC" },
      { field: "createdAt" },
    ],
  },
  SortSchema: {
    valid: [
      [
        { field: "createdAt", dir: "desc" },
        { field: "name", dir: "asc" },
      ],
      [],
    ],
    invalid: [[{ field: "name" }], { field: "name", dir: "asc" }],
  },
};

const schemaNames = Object.keys(fixtures) as SchemaName[];

describe.each(Object.entries(libs))("%s ready-made schemas", (_lib, lib) => {
  test.each(schemaNames)("%s accepts every valid fixture unchanged", (name) => {
    for (const input of fixtures[name].valid) {
      expect(lib.accepts(name, input), JSON.stringify(input)).toBe(true);
      expect(lib.parse(name, input)).toEqual(input);
    }
  });

  test.each(schemaNames)("%s rejects every invalid fixture without crashing", (name) => {
    for (const input of fixtures[name].invalid) {
      expect(lib.accepts(name, input), JSON.stringify(input)).toBe(false);
      expect(() => lib.parse(name, input)).toThrow();
    }
  });

  // A date-only anchor is a valid `Temporal.PlainDateTime` input (midnight), so
  // every library accepts it; valibot also normalizes it to the canonical form.
  test("a date-only anchor is accepted as midnight", () => {
    const dateOnly = { ...preset, anchor: "2026-02-01" };
    expect(lib.accepts("DatePresetSchema", dateOnly)).toBe(true);
    const out = lib.parse("DatePresetSchema", dateOnly) as { anchor: string };
    expect(["2026-02-01", "2026-02-01T00:00:00"]).toContain(out.anchor);
  });
});

test("every library exports exactly the same schema names", () => {
  const names = (m: object) => Object.keys(m).sort();
  expect(names(valibot)).toEqual([...schemaNames].sort());
  expect(names(zod)).toEqual(names(valibot));
  expect(names(effect)).toEqual(names(valibot));
  expect(names(ark)).toEqual(names(valibot));
});
