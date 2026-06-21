import { describe, expect, test } from "vitest";
import * as v from "valibot";

import { parseAsCodec } from "../src/tanstack/core/built-in-parsers.ts";
import { risonCodec } from "../src/tanstack/rison.ts";

const FiltersSchema = v.object({
  status: v.picklist(["open", "done"]),
  tags: v.array(v.string()),
});

describe("risonCodec", () => {
  test("encodes a validated value to canonical Rison and decodes it back", () => {
    const codec = risonCodec(FiltersSchema);
    const value: v.InferOutput<typeof FiltersSchema> = { status: "open", tags: ["a", "b"] };
    const token = codec.encode(value);

    expect(typeof token).toBe("string");
    expect(codec.decode(token)).toEqual(value);
  });

  test("canonical: same value always yields the same token (stable key order)", () => {
    const codec = risonCodec(FiltersSchema);
    const a = codec.encode({ status: "done", tags: ["x"] });
    const b = codec.encode({ status: "done", tags: ["x"] });

    expect(a).toBe(b);
  });

  test("decode throws on a value that fails schema validation", () => {
    const codec = risonCodec(FiltersSchema);
    const badToken = codec.encode({
      // intentionally wrong shape for the schema
      status: "nope",
      tags: [],
    } as unknown as v.InferOutput<typeof FiltersSchema>);

    expect(() => codec.decode(badToken)).toThrow();
  });

  test("decode throws on a malformed Rison token", () => {
    const codec = risonCodec(FiltersSchema);

    expect(() => codec.decode("!!!not-rison!!!")).toThrow();
  });

  test("via parseAsCodec: a tampered/invalid token resolves to null (not a throw)", () => {
    const parser = parseAsCodec(risonCodec(FiltersSchema));

    expect(parser.parse("!!!garbage!!!")).toBeNull();

    const ok = parser.serialize({ status: "open", tags: ["a"] });
    expect(parser.parse(ok)).toEqual({ status: "open", tags: ["a"] });
  });
});
