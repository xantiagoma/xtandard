import { describe, expect, test } from "vitest";

import { isIterable } from "../src/is-iterable";

describe("isIterable", () => {
  test("array", () => expect(isIterable([1, 2])).toBe(true));
  test("string (primitive, not detected as object)", () => expect(isIterable("hi")).toBe(false));
  test("Set", () => expect(isIterable(new Set())).toBe(true));
  test("Map", () => expect(isIterable(new Map())).toBe(true));
  test("generator result", () => {
    function* gen() {
      yield 1;
    }
    expect(isIterable(gen())).toBe(true);
  });

  test("number", () => expect(isIterable(42)).toBe(false));
  test("null", () => expect(isIterable(null)).toBe(false));
  test("undefined", () => expect(isIterable(undefined)).toBe(false));
  test("plain object", () => expect(isIterable({})).toBe(false));
  test("object with non-function Symbol.iterator", () => {
    expect(isIterable({ [Symbol.iterator]: 42 })).toBe(false);
  });
});
