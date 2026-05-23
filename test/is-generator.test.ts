import { describe, expect, test } from "vitest";

import { isGenerator } from "../src/is-generator";

describe("isGenerator", () => {
  test("sync generator", () => {
    function* gen() {
      yield 1;
    }
    expect(isGenerator(gen())).toBe(true);
  });

  test("async generator is not sync generator", () => {
    async function* gen() {
      yield 1;
    }
    expect(isGenerator(gen())).toBe(false);
  });

  test("plain iterator (no return/throw)", () => {
    expect(isGenerator({ next: () => ({ value: 1, done: false }) })).toBe(false);
  });

  test("plain object", () => expect(isGenerator({})).toBe(false));
  test("null", () => expect(isGenerator(null)).toBe(false));
  test("array", () => expect(isGenerator([1])).toBe(false));
});
