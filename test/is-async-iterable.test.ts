import { describe, expect, test } from "vitest";

import { isAsyncIterable } from "../src/is-async-iterable";

describe("isAsyncIterable", () => {
  test("async generator", () => {
    async function* gen() {
      yield 1;
    }
    expect(isAsyncIterable(gen())).toBe(true);
  });

  test("object with Symbol.asyncIterator", () => {
    const obj = { [Symbol.asyncIterator]: () => ({}) };
    expect(isAsyncIterable(obj)).toBe(true);
  });

  test("array (sync iterable)", () => expect(isAsyncIterable([1])).toBe(false));
  test("plain object", () => expect(isAsyncIterable({})).toBe(false));
  test("null", () => expect(isAsyncIterable(null)).toBe(false));
  test("string", () => expect(isAsyncIterable("hi")).toBe(false));
  test("object with non-function Symbol.asyncIterator", () => {
    expect(isAsyncIterable({ [Symbol.asyncIterator]: 42 })).toBe(false);
  });
});
