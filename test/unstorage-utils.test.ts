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

  test("wrap: different functions don't share entries without toKey", async () => {
    const cache = createCache({ storage: createStorage(), prefix: "api" });
    const getUser = cache.wrap(async (id: string) => `user ${id}`);
    const getPlan = cache.wrap(async (id: string) => `plan ${id}`);

    expect(await getUser("42")).toBe("user 42");
    expect(await getPlan("42")).toBe("plan 42");
    expect(await getUser("42")).toBe("user 42");
  });

  test("wrap: same-named functions with different code don't share entries", async () => {
    const cache = createCache({ storage: createStorage() });
    const load = cache.wrap(async function load(id: number) {
      return id + 1;
    });
    const loadOther = cache.wrap(async function load(id: number) {
      return id * 10;
    });

    expect(await load(2)).toBe(3);
    expect(await loadOther(2)).toBe(20);
  });

  test("wrap: the default key is `<fn name>:<hash(fn)>:<hash(args)>`", async () => {
    const cache = createCache({ storage: createStorage(), prefix: "api" });
    const getUser = cache.wrap(async function getUser(id: string) {
      return { id };
    });

    await getUser("42");

    const keys = await cache.storage.getKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^getUser:[\w-]+:[\w-]+$/);
  });

  test("wrap: an explicit toKey is used as-is", async () => {
    const cache = createCache({ storage: createStorage(), prefix: "api" });
    const getUser = cache.wrap(async (id: string) => ({ id }), { toKey: (id) => `user:${id}` });

    await getUser("42");

    expect(await cache.storage.getKeys()).toEqual(["user:42"]);
  });

  test("wrap: honours storage and prefix overrides", async () => {
    const shared = createStorage();
    const other = createStorage();
    const cache = createCache({ storage: shared, prefix: "api" });

    const reports = cache.wrap(async (id: string) => `report ${id}`, {
      storage: other,
      toKey: (id) => id,
    });
    const scoped = cache.wrap(async (id: string) => `scoped ${id}`, {
      prefix: "reports",
      toKey: (id) => id,
    });

    await reports("1");
    await scoped("2");

    expect(await other.getKeys()).toEqual(["api:1"]);
    expect(await shared.getKeys()).toEqual(["reports:2"]);
  });

  test("decorator: honours storage and prefix overrides", async () => {
    const shared = createStorage();
    const other = createStorage();
    const cache = createCache({ storage: shared, prefix: "svc" });
    // Apply the decorators by hand (what `@cache.decorator(...)` compiles to).
    const decorate = (overrides: Parameters<typeof cache.decorator>[0], name: string) =>
      cache.decorator(overrides)(async (id: string) => `${name} ${id}`, {
        name,
        kind: "method",
      } as ClassMethodDecoratorContext<unknown, (id: string) => Promise<string>>);

    await decorate({ storage: other }, "a").call(null, "1");
    await decorate({ prefix: "b-only" }, "b").call(null, "2");

    const [otherKeys, sharedKeys] = [await other.getKeys(), await shared.getKeys()];
    expect(otherKeys).toHaveLength(1);
    expect(otherKeys[0]).toMatch(/^svc:a:/);
    expect(sharedKeys).toHaveLength(1);
    expect(sharedKeys[0]).toMatch(/^b-only:b:/);
  });
});
