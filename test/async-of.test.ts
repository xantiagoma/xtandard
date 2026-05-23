import { describe, expect, test } from "vitest";

import { asyncOf } from "../src/async-of";
import { collect } from "../src/collect";

describe("asyncOf", () => {
  test("yields all values in order", async () => {
    expect(await collect(asyncOf(1, 2, 3))).toEqual([1, 2, 3]);
  });

  test("yields single value", async () => {
    expect(await collect(asyncOf("a"))).toEqual(["a"]);
  });

  test("yields nothing for no arguments", async () => {
    expect(await collect(asyncOf())).toEqual([]);
  });

  test("returns an async generator", () => {
    const result = asyncOf(1);
    expect(Symbol.asyncIterator in result).toBe(true);
  });

  test("can be iterated multiple times from separate calls", async () => {
    const first = await collect(asyncOf(1, 2));
    const second = await collect(asyncOf(1, 2));
    expect(first).toEqual(second);
  });
});
