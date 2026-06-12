import { describe, expect, expectTypeOf, test } from "vitest";
import {
  type CursorCodec,
  type CursorCodecMaybeAsync,
  createCursorCodec,
  decodeBase64Url,
  encodeBase64Url,
  isIsoDateString,
} from "../src/cursor-codec.ts";
import { isPromise } from "../src/is-promise.ts";

describe("encodeBase64Url / decodeBase64Url", () => {
  test("round-trips ASCII strings", () => {
    expect(decodeBase64Url(encodeBase64Url("hello world"))).toBe("hello world");
  });

  test("round-trips UTF-8 strings", () => {
    const input = "señal — 信号 — सिग्नल — 🚀";
    expect(decodeBase64Url(encodeBase64Url(input))).toBe(input);
  });

  test("produces URL-safe output without padding", () => {
    // crafted to produce '+', '/' and '=' in plain base64
    const input = "\xff\xfe?>~subjects";
    const token = encodeBase64Url(input);
    expect(token).not.toMatch(/[+/=]/);
    expect(decodeBase64Url(token)).toBe(input);
  });

  test("decodes plain base64 (with padding) too", () => {
    const plain = btoa("plain");
    expect(decodeBase64Url(plain)).toBe("plain");
  });
});

describe("isIsoDateString", () => {
  test("accepts dates and datetimes", () => {
    expect(isIsoDateString("2024-01-31")).toBe(true);
    expect(isIsoDateString("2024-01-31T10:30")).toBe(true);
    expect(isIsoDateString("2024-01-31T10:30:00.123Z")).toBe(true);
    expect(isIsoDateString("2024-01-31T10:30:00+05:00")).toBe(true);
  });

  test("rejects non-dates", () => {
    expect(isIsoDateString("hello")).toBe(false);
    expect(isIsoDateString("2024-99-99")).toBe(false);
    expect(isIsoDateString(20240131)).toBe(false);
    expect(isIsoDateString(null)).toBe(false);
  });
});

describe("createCursorCodec", () => {
  test("round-trips a plain object", () => {
    const codec = createCursorCodec();
    const data = { id: 7, name: "ada" };
    expect(codec.decode(codec.encode(data))).toEqual(data);
  });

  test("produces an opaque, URL-safe token", () => {
    const codec = createCursorCodec();
    const token = codec.encode({ id: 7 });
    expect(token).not.toContain("{");
    expect(token).not.toMatch(/[+/=]/);
  });

  test("revives Date values on decode by default", () => {
    const codec = createCursorCodec();
    const createdAt = new Date("2024-01-31T10:30:00.123Z");
    const decoded = codec.decode(codec.encode({ id: 1, createdAt }));
    expect(decoded.createdAt).toBeInstanceOf(Date);
    expect((decoded.createdAt as Date).toISOString()).toBe(createdAt.toISOString());
  });

  test("leaves ISO strings untouched with reviveDates: false", () => {
    const codec = createCursorCodec({ reviveDates: false });
    const decoded = codec.decode(codec.encode({ when: "2024-01-31" }));
    expect(decoded.when).toBe("2024-01-31");
  });

  test("supports a custom encoder/decoder stage", () => {
    const codec = createCursorCodec({
      encoder: (str) => `rot:${str.split("").reverse().join("")}`,
      decoder: (token) => token.slice(4).split("").reverse().join(""),
    });
    const data = { id: 42 };
    expect(codec.encode(data).startsWith("rot:")).toBe(true);
    expect(codec.decode(codec.encode(data))).toEqual(data);
  });

  test("supports a custom serializer/parser stage", () => {
    const codec = createCursorCodec<{ id: number }>({
      serializer: (data) => `id=${data.id}`,
      parser: (raw) => ({ id: Number(raw.slice(3)) }),
    });
    expect(codec.decode(codec.encode({ id: 99 }))).toEqual({ id: 99 });
  });

  test("is interoperable with drizzle-cursor's default format", () => {
    // drizzle-cursor default: btoa(JSON.stringify(item)) — plain base64
    const drizzleToken = btoa(JSON.stringify({ id: 5, createdAt: "2024-01-31T10:30:00.000Z" }));
    const codec = createCursorCodec();
    const decoded = codec.decode(drizzleToken);
    expect(decoded.id).toBe(5);
    expect(decoded.createdAt).toBeInstanceOf(Date);
  });
});

describe("createCursorCodec — sync/async adaptive", () => {
  test("default codec is fully synchronous", () => {
    const codec = createCursorCodec<{ id: number }>();
    expectTypeOf(codec).toEqualTypeOf<CursorCodec<{ id: number }>>();

    const token = codec.encode({ id: 1 });
    expect(isPromise(token)).toBe(false);
    expect(codec.decode(token)).toEqual({ id: 1 });
  });

  test("one async stage makes the codec async (types + runtime)", async () => {
    const codec = createCursorCodec<{ id: number }>({
      encoder: async (str) => `x${str}`,
      decoder: (token) => token.slice(1),
    });
    expectTypeOf(codec).toEqualTypeOf<CursorCodecMaybeAsync<{ id: number }>>();

    const token = codec.encode({ id: 1 });
    expect(isPromise(token)).toBe(true);
    expect(await codec.decode(await token)).toEqual({ id: 1 });
  });
});
