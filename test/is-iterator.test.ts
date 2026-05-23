import { describe, expect, test } from "vitest";

import { isIterator } from "../src/is-iterator";

describe("isIterator", () => {
  test("array iterator", () => {
    expect(isIterator([1][Symbol.iterator]())).toBe(true);
  });

  test("manual iterator", () => {
    expect(isIterator({ next: () => ({ value: 1, done: false }) })).toBe(true);
  });

  test("generator result", () => {
    function* gen() {
      yield 1;
    }
    expect(isIterator(gen())).toBe(true);
  });

  test("array (iterable, not iterator)", () => {
    expect(isIterator([1, 2])).toBe(false);
  });

  test("plain object", () => expect(isIterator({})).toBe(false));
  test("null", () => expect(isIterator(null)).toBe(false));
  test("string", () => expect(isIterator("hi")).toBe(false));
  test("object with non-function next", () => {
    expect(isIterator({ next: 42 })).toBe(false);
  });
});
