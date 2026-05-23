import { describe, expect, test } from "vitest";

import { collect } from "../src/collect";
import { enumerate, enumerateAsync } from "../src/enumerate";

describe("enumerate", () => {
  test("yields index-value pairs", () => {
    expect([...enumerate(["a", "b", "c"])]).toEqual([
      [0, "a"],
      [1, "b"],
      [2, "c"],
    ]);
  });

  test("custom start index", () => {
    expect([...enumerate(["a", "b"], 5)]).toEqual([
      [5, "a"],
      [6, "b"],
    ]);
  });

  test("empty iterable", () => {
    expect([...enumerate([])]).toEqual([]);
  });
});

describe("enumerateAsync", () => {
  test("yields index-value pairs", async () => {
    async function* gen() {
      yield "a";
      yield "b";
    }
    expect(await collect(enumerateAsync(gen()))).toEqual([
      [0, "a"],
      [1, "b"],
    ]);
  });

  test("custom start index", async () => {
    expect(await collect(enumerateAsync(["x", "y"], 10))).toEqual([
      [10, "x"],
      [11, "y"],
    ]);
  });

  test("empty source", async () => {
    expect(await collect(enumerateAsync([]))).toEqual([]);
  });
});
