import { describe, expect, test } from "vitest";

import { isAsyncGenerator } from "../src/is-async-generator";

describe("isAsyncGenerator", () => {
  test("async generator", () => {
    async function* gen() {
      yield 1;
    }
    expect(isAsyncGenerator(gen())).toBe(true);
  });

  test("sync generator is not async", () => {
    function* gen() {
      yield 1;
    }
    expect(isAsyncGenerator(gen())).toBe(false);
  });

  test("plain async iterator (no return)", () => {
    expect(
      isAsyncGenerator({
        [Symbol.asyncIterator]: () => ({}),
        next: async () => ({ value: 1, done: false }),
      }),
    ).toBe(false);
  });

  test("plain object", () => expect(isAsyncGenerator({})).toBe(false));
  test("null", () => expect(isAsyncGenerator(null)).toBe(false));
});
