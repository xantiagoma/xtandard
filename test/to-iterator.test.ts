import { describe, expect, test } from "vitest";

import { toIterator } from "../src/to-iterator";

describe("toIterator", () => {
  test("converts an array (iterable) to iterator", () => {
    const it = toIterator([1, 2, 3]);
    expect(it.next()).toEqual({ value: 1, done: false });
    expect(it.next()).toEqual({ value: 2, done: false });
    expect(it.next()).toEqual({ value: 3, done: false });
    expect(it.next()).toEqual({ value: undefined, done: true });
  });

  test("passes through an existing iterator", () => {
    const original = [1, 2][Symbol.iterator]();
    const it = toIterator(original);
    expect(it).toBe(original);
  });

  test("converts a Set to iterator", () => {
    const it = toIterator(new Set(["a", "b"]));
    expect(it.next().value).toBe("a");
    expect(it.next().value).toBe("b");
    expect(it.next().done).toBe(true);
  });

  test("converts a Map to iterator", () => {
    const map = new Map([["k", 1]]);
    const it = toIterator(map);
    expect(it.next()).toEqual({ value: ["k", 1], done: false });
  });

  test("works with generator function result", () => {
    function* gen() {
      yield 10;
      yield 20;
    }
    const it = toIterator(gen());
    expect(it.next()).toEqual({ value: 10, done: false });
    expect(it.next()).toEqual({ value: 20, done: false });
    expect(it.next()).toEqual({ value: undefined, done: true });
  });

  test("converts a string to iterator", () => {
    const it = toIterator("ab");
    expect(it.next()).toEqual({ value: "a", done: false });
    expect(it.next()).toEqual({ value: "b", done: false });
    expect(it.next()).toEqual({ value: undefined, done: true });
  });

  test("empty iterable", () => {
    const it = toIterator([]);
    expect(it.next()).toEqual({ value: undefined, done: true });
  });
});
