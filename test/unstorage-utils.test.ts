import { describe, test, expect } from "vitest";
import { createStorage } from "unstorage";
import { withCache, createCache } from "../src/unstorage-utils.ts";

describe("withCache", () => {
  test("caches function results", async () => {
    const storage = createStorage();
    let callCount = 0;

    const fn = withCache(
      async (x: number) => {
        callCount++;
        return x * 2;
      },
      { storage, prefix: "test" },
    );

    const r1 = await fn(5);
    const r2 = await fn(5);

    expect(r1).toBe(10);
    expect(r2).toBe(10);
    expect(callCount).toBe(1);
  });

  test("different args produce different cache entries", async () => {
    const storage = createStorage();
    let callCount = 0;

    const fn = withCache(
      async (x: number) => {
        callCount++;
        return x * 2;
      },
      { storage },
    );

    await fn(5);
    await fn(10);
    expect(callCount).toBe(2);
  });
});

describe("createCache", () => {
  test("wrap returns a cached function", async () => {
    const storage = createStorage();
    const cache = createCache({ storage, prefix: "c" });

    let calls = 0;
    const fn = cache.wrap(async (x: number) => {
      calls++;
      return x * 2;
    });

    const r1 = await fn(5);
    const r2 = await fn(5);

    expect(r1).toBe(10);
    expect(r2).toBe(10);
    expect(calls).toBe(1);
  });
});
