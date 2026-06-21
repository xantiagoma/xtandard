import { describe, expect, test } from "vitest";

import { parseAsIndex, parseAsString } from "../src/tanstack/core/built-in-parsers.ts";
import {
  createStandardSchemaV1,
  type StandardSchemaV1,
  validateWithStandardSchema,
} from "../src/tanstack/core/standard-schema.ts";

function run<T>(schema: StandardSchemaV1<unknown, T>, value: unknown) {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) throw new Error("unexpected async");
  return result;
}

/** Narrow a sync `Result<T>` to its success value (throws on issues). */
function ok<T>(result: StandardSchemaV1.Result<T>): T {
  if (result.issues) throw new Error(result.issues.map((issue) => issue.message).join("; "));
  return result.value;
}

describe("createStandardSchemaV1", () => {
  const schema = createStandardSchemaV1({
    q: parseAsString.withDefault(""),
    page: parseAsIndex.withDefault(0),
  });

  test("parses a TanStack-style search object", () => {
    const result = run(schema, { q: "hi", page: 2 });
    expect(result.issues).toBeUndefined();
    expect(ok(result)).toEqual({ q: "hi", page: 1 });
  });

  test("applies defaults for missing keys", () => {
    expect(ok(run(schema, {}))).toEqual({ q: "", page: 0 });
  });

  test("rejects non-objects", () => {
    expect(run(schema, "nope").issues).toBeDefined();
  });

  test("urlKeys remap", () => {
    const remapped = createStandardSchemaV1(
      { query: parseAsString.withDefault("") },
      { urlKeys: { query: "q" } },
    );
    expect(ok(run(remapped, { q: "found" }))).toEqual({ query: "found" });
  });
});

describe("validateWithStandardSchema", () => {
  const schema = createStandardSchemaV1({ q: parseAsString.withDefault("") });

  test("returns the validated output", () => {
    expect(validateWithStandardSchema(schema, { q: "x" })).toEqual({ q: "x" });
  });
});
