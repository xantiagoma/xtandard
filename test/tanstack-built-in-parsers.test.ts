import { describe, expect, test } from "vitest";

import type { StandardSchemaV1 } from "../src/tanstack/core/standard-schema.ts";

import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsCodec,
  parseAsFloat,
  parseAsHex,
  parseAsIndex,
  parseAsInteger,
  parseAsIsoDate,
  parseAsIsoDateTime,
  parseAsJson,
  parseAsNativeArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringEnum,
  parseAsStringLiteral,
  parseAsTimestamp,
  parseAsStandardSchema,
  type ValueCodec,
  withTransport,
} from "../src/tanstack/core/built-in-parsers.ts";

describe("scalar parsers", () => {
  test("string round-trips", () => {
    expect(parseAsString.parse("foo")).toBe("foo");
    expect(parseAsString.serialize("bar")).toBe("bar");
  });

  test("integer parses and rounds on serialize", () => {
    expect(parseAsInteger.parse("42")).toBe(42);
    expect(parseAsInteger.parse("3.9")).toBe(3);
    expect(parseAsInteger.parse("banana")).toBeNull();
    expect(parseAsInteger.serialize(3.6)).toBe("4");
  });

  test("float", () => {
    expect(parseAsFloat.parse("3.14")).toBe(3.14);
    expect(parseAsFloat.parse("nope")).toBeNull();
    expect(parseAsFloat.serialize(2.5)).toBe("2.5");
  });

  test("hex", () => {
    expect(parseAsHex.parse("ff")).toBe(255);
    expect(parseAsHex.serialize(255)).toBe("ff");
  });

  test("boolean (only 'true' is true)", () => {
    expect(parseAsBoolean.parse("true")).toBe(true);
    expect(parseAsBoolean.parse("false")).toBe(false);
    expect(parseAsBoolean.parse("anything")).toBe(false);
    expect(parseAsBoolean.serialize(true)).toBe("true");
  });

  test("index is 1-indexed in URL, 0-indexed in state", () => {
    expect(parseAsIndex.parse("1")).toBe(0);
    expect(parseAsIndex.parse("2")).toBe(1);
    expect(parseAsIndex.serialize(0)).toBe("1");
    expect(parseAsIndex.serialize(4)).toBe("5");
    expect(parseAsIndex.parse("nope")).toBeNull();
  });
});

describe("date parsers", () => {
  test("iso datetime", () => {
    const date = parseAsIsoDateTime.parse("2026-06-20T10:00:00.000Z");
    expect(date?.toISOString()).toBe("2026-06-20T10:00:00.000Z");
    expect(parseAsIsoDateTime.parse("not-a-date")).toBeNull();
    expect(parseAsIsoDateTime.eq(new Date(0), new Date(0))).toBe(true);
  });

  test("iso date (no time)", () => {
    const date = parseAsIsoDate.parse("2026-06-20");
    expect(date).not.toBeNull();
    if (date) expect(parseAsIsoDate.serialize(date)).toBe("2026-06-20");
  });

  test("timestamp (epoch ms)", () => {
    expect(parseAsTimestamp.parse("1000")?.valueOf()).toBe(1000);
    expect(parseAsTimestamp.serialize(new Date(1000))).toBe("1000");
    expect(parseAsTimestamp.parse("x")).toBeNull();
  });
});

describe("literal / enum parsers", () => {
  test("string literal", () => {
    const p = parseAsStringLiteral(["open", "closed"] as const);
    expect(p.parse("open")).toBe("open");
    expect(p.parse("nope")).toBeNull();
  });

  test("number literal", () => {
    const p = parseAsNumberLiteral([10, 20, 50] as const);
    expect(p.parse("20")).toBe(20);
    expect(p.parse("30")).toBeNull();
  });

  test("string enum", () => {
    const Role = { Admin: "admin", User: "user" } as const;
    const p = parseAsStringEnum(Role);
    expect(p.parse("admin")).toBe("admin");
    expect(p.parse("ghost")).toBeNull();
  });
});

describe("array parsers", () => {
  test("comma-separated array", () => {
    const p = parseAsArrayOf(parseAsInteger);
    expect(p.parse("1,2,3")).toEqual([1, 2, 3]);
    expect(p.parse("")).toEqual([]);
    expect(p.serialize([1, 2, 3])).toBe("1,2,3");
  });

  test("array encodes separators inside items", () => {
    const p = parseAsArrayOf(parseAsString);
    const serialized = p.serialize(["a,b", "c"]);
    expect(p.parse(serialized)).toEqual(["a,b", "c"]);
  });

  test("array eq", () => {
    const p = parseAsArrayOf(parseAsInteger);
    expect(p.eq([1, 2], [1, 2])).toBe(true);
    expect(p.eq([1, 2], [1, 3])).toBe(false);
  });

  test("native array (repeated keys) defaults to []", () => {
    const p = parseAsNativeArrayOf(parseAsString);
    expect(p.hasDefault).toBe(true);
    expect(p.defaultValue).toEqual([]);
    expect(p.parse(["a", "b"])).toEqual(["a", "b"]);
    expect(p.serialize(["x", "y"])).toEqual(["x", "y"]);
  });
});

describe("json parser", () => {
  const validator = (value: unknown): { n: number } => {
    if (typeof value === "object" && value !== null) {
      const n: unknown = Reflect.get(value, "n");
      if (typeof n === "number") return { n };
    }
    throw new Error("invalid");
  };

  test("valid json parses", () => {
    const p = parseAsJson(validator);
    expect(p.parse('{"n":5}')).toEqual({ n: 5 });
  });

  test("invalid json returns null", () => {
    const p = parseAsJson(validator);
    expect(p.parse("{bad")).toBeNull();
  });

  test("schema-rejected shape returns null", () => {
    const p = parseAsJson(validator);
    expect(p.parse('{"x":1}')).toBeNull();
  });

  test("eq by serialized form", () => {
    const p = parseAsJson(validator);
    expect(p.eq({ n: 1 }, { n: 1 })).toBe(true);
    expect(p.eq({ n: 1 }, { n: 2 })).toBe(false);
  });
});

describe("parseAsStandardSchema (Zod/Valibot/ArkType)", () => {
  // Minimal hand-rolled Standard Schema (no external validator dep needed).
  const numberSchema: StandardSchemaV1<unknown, number> = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => {
        const n = Number(value);
        return Number.isFinite(n) && value !== ""
          ? { value: n }
          : { issues: [{ message: "not a number" }] };
      },
    },
  };

  test("validates and returns the schema output", () => {
    const p = parseAsStandardSchema(numberSchema);
    expect(p.parse("42")).toBe(42);
  });

  test("invalid input → null", () => {
    expect(parseAsStandardSchema(numberSchema).parse("nope")).toBeNull();
  });

  test("serializes scalars without JSON-quoting strings", () => {
    const p = parseAsStandardSchema(numberSchema);
    expect(p.serialize(7)).toBe("7");
  });
});

describe("parseAsCodec (custom encoder/decoder via a codec)", () => {
  // A trivial sync codec, signature-compatible with xantiagoma's CursorCodec.
  const codec: ValueCodec<{ id: number }> = {
    encode: (data) => `id:${data.id}`,
    decode: (token) => {
      const match = /^id:(\d+)$/.exec(token);
      if (!match) throw new Error("bad token");
      return { id: Number(match[1]) };
    },
  };

  test("round-trips structured data through an opaque token", () => {
    const p = parseAsCodec(codec);
    const token = p.serialize({ id: 7 });
    expect(token).toBe("id:7");
    expect(p.parse(token)).toEqual({ id: 7 });
  });

  test("decode failure → null", () => {
    expect(parseAsCodec(codec).parse("garbage")).toBeNull();
  });

  test("structural eq by default (encoder may be non-deterministic)", () => {
    const p = parseAsCodec(codec);
    expect(p.eq({ id: 1 }, { id: 1 })).toBe(true);
    expect(p.eq({ id: 1 }, { id: 2 })).toBe(false);
  });
});

describe("withTransport (encoder/decoder layer over any parser)", () => {
  const transport = {
    encode: (raw: string) => `x${raw}`,
    decode: (token: string) => {
      if (!token.startsWith("x")) throw new Error("bad");
      return token.slice(1);
    },
  };

  test("wraps serialize/parse with the transport", () => {
    const p = withTransport(parseAsInteger, transport);
    expect(p.serialize(42)).toBe("x42");
    expect(p.parse("x42")).toBe(42);
  });

  test("transport decode failure → null", () => {
    expect(withTransport(parseAsInteger, transport).parse("nope")).toBeNull();
  });

  test("composes with .withDefault applied after wrapping", () => {
    const p = withTransport(parseAsInteger, transport).withDefault(0);
    expect(p.hasDefault).toBe(true);
    expect(p.defaultValue).toBe(0);
  });
});

describe("withDefault / withOptions immutability", () => {
  test("withDefault creates a new parser, original unchanged", () => {
    const withDefault = parseAsInteger.withDefault(5);
    expect(withDefault.hasDefault).toBe(true);
    expect(withDefault.defaultValue).toBe(5);
    expect(parseAsInteger.hasDefault).toBe(false);
  });

  test("withOptions merges options", () => {
    const p = parseAsInteger.withOptions({ history: "push" }).withOptions({
      shallow: false,
    });
    expect(p.options).toEqual({ history: "push", shallow: false });
    expect(parseAsInteger.options).toBeUndefined();
  });
});
