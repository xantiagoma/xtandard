import { describe, expect, test } from "vitest";

import { asyncOf } from "../src/async-of";
import { collect } from "../src/collect";

describe("collect", () => {
  test("collects values from async generator", async () => {
    expect(await collect(asyncOf(1, 2, 3))).toEqual([1, 2, 3]);
  });

  test("returns empty array for empty source", async () => {
    expect(await collect(asyncOf())).toEqual([]);
  });

  test("collects single value", async () => {
    expect(await collect(asyncOf("a"))).toEqual(["a"]);
  });

  test("preserves order", async () => {
    expect(await collect(asyncOf("c", "a", "b"))).toEqual(["c", "a", "b"]);
  });

  test("works with delayed yields", async () => {
    async function* delayed() {
      yield 1;
      await new Promise((r) => setTimeout(r, 5));
      yield 2;
    }
    expect(await collect(delayed())).toEqual([1, 2]);
  });

  test("returns a Promise", () => {
    const result = collect(asyncOf());
    expect(result).toBeInstanceOf(Promise);
  });
});
