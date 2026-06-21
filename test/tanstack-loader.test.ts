import { describe, expect, test } from "vitest";

import {
  parseAsIndex,
  parseAsNativeArrayOf,
  parseAsString,
} from "../src/tanstack/core/built-in-parsers.ts";
import { createLoader } from "../src/tanstack/core/loader.ts";

const load = createLoader({
  q: parseAsString.withDefault(""),
  page: parseAsIndex.withDefault(0),
  tag: parseAsNativeArrayOf(parseAsString),
});

describe("createLoader inputs", () => {
  test("full URL string", () => {
    expect(load("https://h.dev/x?q=hi&page=2")).toEqual({
      q: "hi",
      page: 1,
      tag: [],
    });
  });

  test("query string", () => {
    expect(load("?q=hi").q).toBe("hi");
  });

  test("URL", () => {
    expect(load(new URL("https://h.dev/x?page=3")).page).toBe(2);
  });

  test("URLSearchParams", () => {
    expect(load(new URLSearchParams("q=z")).q).toBe("z");
  });

  test("Request", () => {
    expect(load(new Request("https://h.dev/x?q=req")).q).toBe("req");
  });

  test("record with string arrays", () => {
    expect(load({ tag: ["a", "b"] }).tag).toEqual(["a", "b"]);
  });

  test("promise input → promise output", async () => {
    const result = load(Promise.resolve("?q=async"));
    expect(result).toBeInstanceOf(Promise);
    expect((await result).q).toBe("async");
  });

  test("defaults when absent", () => {
    expect(load("")).toEqual({ q: "", page: 0, tag: [] });
  });
});

describe("strict mode", () => {
  const strictLoad = createLoader({ page: parseAsIndex });

  test("throws on present-but-invalid value", () => {
    expect(() => strictLoad("?page=banana", { strict: true })).toThrow();
  });

  test("does not throw when absent", () => {
    expect(() => strictLoad("", { strict: true })).not.toThrow();
  });

  test("non-strict returns null for invalid", () => {
    expect(strictLoad("?page=banana").page).toBeNull();
  });
});
