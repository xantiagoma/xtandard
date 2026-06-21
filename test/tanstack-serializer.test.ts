import { describe, expect, test } from "vitest";

import {
  parseAsIndex,
  parseAsInteger,
  parseAsNativeArrayOf,
  parseAsString,
} from "../src/tanstack/core/built-in-parsers.ts";
import { createSerializer } from "../src/tanstack/core/serializer.ts";

const serialize = createSerializer({
  q: parseAsString,
  page: parseAsIndex,
});

describe("createSerializer", () => {
  test("values only → query string with leading ?", () => {
    expect(serialize({ q: "camera", page: 2 })).toBe("?q=camera&page=3");
  });

  test("empty → empty string", () => {
    expect(serialize({})).toBe("");
  });

  test("string base", () => {
    expect(serialize("/users", { q: "camera" })).toBe("/users?q=camera");
  });

  test("string base preserves existing + hash", () => {
    expect(serialize("/users?sort=name#top", { q: "x" })).toBe("/users?sort=name&q=x#top");
  });

  test("URL base preserves origin and unrelated params", () => {
    expect(serialize(new URL("https://h.dev/u?a=1"), { q: "x" })).toBe("https://h.dev/u?a=1&q=x");
  });

  test("null removes a key", () => {
    expect(serialize("/u?q=old", { q: null })).toBe("/u");
  });

  test("clearOnDefault removes default values", () => {
    const s = createSerializer({ page: parseAsInteger.withDefault(0) });
    expect(s({ page: 0 })).toBe("");
    expect(s({ page: 2 })).toBe("?page=2");
  });

  test("urlKeys remap", () => {
    const s = createSerializer({ query: parseAsString }, { urlKeys: { query: "q" } });
    expect(s({ query: "hi" })).toBe("?q=hi");
  });

  test("native arrays as repeated keys", () => {
    const s = createSerializer({ tag: parseAsNativeArrayOf(parseAsString) });
    expect(s({ tag: ["a", "b"] })).toBe("?tag=a&tag=b");
  });

  test("processUrlSearchParams middleware runs before serialization", () => {
    const s = createSerializer(
      { q: parseAsString },
      {
        processUrlSearchParams: (params) => {
          params.set("injected", "1");
          return params;
        },
      },
    );
    expect(s({ q: "x" })).toBe("?q=x&injected=1");
  });
});
