import { describe, expect, expectTypeOf, test } from "vitest";

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

describe("collect — sync sources (adaptive)", () => {
  test("collects a sync iterable synchronously, no await needed", () => {
    const result = collect(new Set([1, 2, 3]));
    expectTypeOf(result).toEqualTypeOf<number[]>();
    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toEqual([1, 2, 3]);
  });

  test("collects strings and generators", () => {
    expect(collect("abc")).toEqual(["a", "b", "c"]);
    function* gen() {
      yield 1;
      yield 2;
    }
    expect(collect(gen())).toEqual([1, 2]);
  });

  test("await still works on the sync result", async () => {
    expect(await collect([1, 2])).toEqual([1, 2]);
  });
});
