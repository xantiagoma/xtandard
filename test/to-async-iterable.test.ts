import { describe, expect, test } from "vitest";

import { collect } from "../src/collect";
import { toAsyncIterable } from "../src/to-async-iterable";

describe("toAsyncIterable", () => {
  describe("from Iterable", () => {
    test("array", async () => {
      expect(await collect(toAsyncIterable([1, 2, 3]))).toEqual([1, 2, 3]);
    });

    test("Set", async () => {
      expect(await collect(toAsyncIterable(new Set(["a", "b"])))).toEqual(["a", "b"]);
    });

    test("empty array", async () => {
      expect(await collect(toAsyncIterable([]))).toEqual([]);
    });

    test("string", async () => {
      expect(await collect(toAsyncIterable("hi"))).toEqual(["h", "i"]);
    });
  });

  describe("from Iterator (sync)", () => {
    test("generator", async () => {
      function* gen() {
        yield 1;
        yield 2;
      }
      // Generator is both Iterable and Iterator — pass the iterator directly
      const it = gen();
      expect(await collect(toAsyncIterable(it))).toEqual([1, 2]);
    });

    test("manual iterator (not iterable)", async () => {
      let i = 0;
      const it: Iterator<number> = {
        next() {
          i++;
          return i <= 3 ? { value: i, done: false } : { value: undefined, done: true };
        },
      };
      expect(await collect(toAsyncIterable(it))).toEqual([1, 2, 3]);
    });

    test("empty iterator", async () => {
      const it: Iterator<number> = {
        next() {
          return { value: undefined, done: true };
        },
      };
      expect(await collect(toAsyncIterable(it))).toEqual([]);
    });
  });

  describe("from AsyncIterable", () => {
    test("async generator", async () => {
      async function* gen() {
        yield 1;
        yield 2;
        yield 3;
      }
      expect(await collect(toAsyncIterable(gen()))).toEqual([1, 2, 3]);
    });

    test("empty async generator", async () => {
      async function* gen() {
        // empty
      }
      expect(await collect(toAsyncIterable(gen()))).toEqual([]);
    });
  });

  describe("from AsyncIterator (not iterable)", () => {
    test("manual async iterator", async () => {
      let i = 0;
      const it: AsyncIterator<number> = {
        async next() {
          i++;
          return i <= 2 ? { value: i, done: false } : { value: undefined, done: true };
        },
      };
      expect(await collect(toAsyncIterable(it))).toEqual([1, 2]);
    });

    test("empty async iterator", async () => {
      const it: AsyncIterator<number> = {
        async next() {
          return { value: undefined, done: true };
        },
      };
      expect(await collect(toAsyncIterable(it))).toEqual([]);
    });
  });

  test("result is async iterable", async () => {
    const result = toAsyncIterable([1]);
    expect(Symbol.asyncIterator in result).toBe(true);
  });
});
