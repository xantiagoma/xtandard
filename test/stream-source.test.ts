import { describe, expect, test } from "vitest";

import type { StreamSource } from "../src/stream-source";

import { collect } from "../src/collect";
import { resolveStreamSource } from "../src/stream-source";
import { toAsyncIterable } from "../src/to-async-iterable";

async function drain<T>(source: StreamSource<T>): Promise<T[]> {
  return collect(toAsyncIterable(resolveStreamSource(source)));
}

describe("resolveStreamSource", () => {
  describe("instances (returned as-is)", () => {
    test("Array (Iterable)", () => {
      const arr = [1, 2, 3];
      expect(resolveStreamSource(arr)).toBe(arr);
    });

    test("Set (Iterable)", () => {
      const set = new Set([1, 2]);
      expect(resolveStreamSource(set)).toBe(set);
    });

    test("Map (Iterable)", () => {
      const map = new Map([["a", 1]]);
      expect(resolveStreamSource(map)).toBe(map);
    });

    test("string (Iterable)", () => {
      expect(resolveStreamSource("abc")).toBe("abc");
    });

    test("sync Generator", () => {
      function* gen() {
        yield 1;
      }
      const instance = gen();
      expect(resolveStreamSource(instance)).toBe(instance);
    });

    test("sync Iterator (manual)", () => {
      let i = 0;
      const it: Iterator<number> = {
        next: () => (++i <= 2 ? { value: i, done: false } : { value: undefined, done: true }),
      };
      expect(resolveStreamSource(it)).toBe(it);
    });

    test("async Generator", () => {
      async function* gen() {
        yield 1;
      }
      const instance = gen();
      expect(resolveStreamSource(instance)).toBe(instance);
    });

    test("async Iterator (manual)", () => {
      const it: AsyncIterator<number> = { next: async () => ({ value: undefined, done: true }) };
      expect(resolveStreamSource(it)).toBe(it);
    });

    test("async Iterable (custom)", () => {
      const iterable: AsyncIterable<number> = {
        [Symbol.asyncIterator]: () => ({ next: async () => ({ value: undefined, done: true }) }),
      };
      expect(resolveStreamSource(iterable)).toBe(iterable);
    });
  });

  describe("factories (called and result returned)", () => {
    test("factory returning Array", () => {
      const factory = () => [1, 2, 3];
      const result = resolveStreamSource(factory);
      expect(result).toEqual([1, 2, 3]);
      expect(result).not.toBe(factory);
    });

    test("factory returning sync Generator", () => {
      function* gen() {
        yield 1;
        yield 2;
      }
      const result = resolveStreamSource(gen);
      expect([...(result as Generator<number>)]).toEqual([1, 2]);
    });

    test("factory returning async Generator", () => {
      async function* gen() {
        yield 1;
        yield 2;
      }
      const result = resolveStreamSource(gen);
      expect(result).not.toBe(gen);
    });

    test("factory creates fresh instance each call", () => {
      function* gen() {
        yield 1;
      }
      const a = resolveStreamSource(gen);
      const b = resolveStreamSource(gen);
      expect(a).not.toBe(b);
    });
  });

  describe("end-to-end: drain all source types", () => {
    test("Array", async () => {
      expect(await drain([1, 2, 3])).toEqual([1, 2, 3]);
    });

    test("Set", async () => {
      expect(await drain(new Set(["a", "b"]))).toEqual(["a", "b"]);
    });

    test("sync Generator instance", async () => {
      function* gen() {
        yield 10;
        yield 20;
      }
      expect(await drain(gen())).toEqual([10, 20]);
    });

    test("sync Generator factory", async () => {
      function* gen() {
        yield 10;
        yield 20;
      }
      expect(await drain(gen)).toEqual([10, 20]);
    });

    test("async Generator instance", async () => {
      async function* gen() {
        yield 1;
        yield 2;
      }
      expect(await drain(gen())).toEqual([1, 2]);
    });

    test("async Generator factory", async () => {
      async function* gen() {
        yield 1;
        yield 2;
      }
      expect(await drain(gen)).toEqual([1, 2]);
    });

    test("manual sync Iterator", async () => {
      let i = 0;
      const it: Iterator<number> = {
        next: () => (++i <= 3 ? { value: i, done: false } : { value: undefined, done: true }),
      };
      expect(await drain(it)).toEqual([1, 2, 3]);
    });

    test("manual async Iterator", async () => {
      let i = 0;
      const it: AsyncIterator<number> = {
        next: async () => (++i <= 2 ? { value: i, done: false } : { value: undefined, done: true }),
      };
      expect(await drain(it)).toEqual([1, 2]);
    });

    test("custom async Iterable", async () => {
      const iterable: AsyncIterable<string> = {
        [Symbol.asyncIterator]: () => {
          let done = false;
          return {
            next: async () => {
              if (done) return { value: undefined, done: true };
              done = true;
              return { value: "hello", done: false };
            },
          };
        },
      };
      expect(await drain(iterable)).toEqual(["hello"]);
    });

    test("factory returning Array", async () => {
      expect(await drain(() => [4, 5, 6])).toEqual([4, 5, 6]);
    });

    test("empty sources", async () => {
      expect(await drain([])).toEqual([]);
      expect(await drain(new Set())).toEqual([]);
      function* empty() {}
      expect(await drain(empty)).toEqual([]);
      async function* asyncEmpty() {}
      expect(await drain(asyncEmpty)).toEqual([]);
    });
  });
});
