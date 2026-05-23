import { describe, expect, test } from "vitest";

import { prepareLoaderResult } from "../src/prepare-loader-result";

describe("prepareLoaderResult", () => {
  describe("one-to-one (default)", () => {
    test("maps results by id in key order", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b", "c"],
        results: [
          { id: "c", name: "Charlie" },
          { id: "a", name: "Alice" },
          { id: "b", name: "Bob" },
        ],
      });
      expect(result).toEqual([
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
        { id: "c", name: "Charlie" },
      ]);
    });

    test("maps results by uid when no id", async () => {
      const result = await prepareLoaderResult({
        keys: ["x", "y"],
        results: [
          { uid: "y", val: 2 },
          { uid: "x", val: 1 },
        ],
      });
      expect(result).toEqual([
        { uid: "x", val: 1 },
        { uid: "y", val: 2 },
      ]);
    });

    test("returns undefined for missing keys", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b", "c"],
        results: [{ id: "a", name: "Alice" }],
      });
      expect(result).toEqual([{ id: "a", name: "Alice" }, undefined, undefined]);
    });

    test("empty results returns all undefined", async () => {
      const result = await prepareLoaderResult({ keys: ["a", "b"], results: [] });
      expect(result).toEqual([undefined, undefined]);
    });

    test("empty keys returns empty array", async () => {
      const result = await prepareLoaderResult({ keys: [], results: [{ id: "a" }] });
      expect(result).toEqual([]);
    });

    test("throws if no id or uid found", async () => {
      expect(prepareLoaderResult({ keys: ["a"], results: [{ name: "no key" }] })).rejects.toThrow(
        "Unable to find row key",
      );
    });

    test("numeric keys", async () => {
      const result = await prepareLoaderResult({
        keys: [1, 2, 3],
        results: [
          { id: 2, name: "two" },
          { id: 1, name: "one" },
          { id: 3, name: "three" },
        ],
      });
      expect(result).toEqual([
        { id: 1, name: "one" },
        { id: 2, name: "two" },
        { id: 3, name: "three" },
      ]);
    });

    test("duplicate keys get same result", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "a", "b"],
        results: [
          { id: "a", val: 1 },
          { id: "b", val: 2 },
        ],
      });
      expect(result).toEqual([
        { id: "a", val: 1 },
        { id: "a", val: 1 },
        { id: "b", val: 2 },
      ]);
    });
  });

  describe("custom getKey", () => {
    test("uses custom key extractor", async () => {
      const result = await prepareLoaderResult({
        keys: [1, 2, 3],
        results: [
          { userId: 3, name: "C" },
          { userId: 1, name: "A" },
        ],
        getKey: (r) => r.userId,
      });
      expect(result).toEqual([{ userId: 1, name: "A" }, undefined, { userId: 3, name: "C" }]);
    });
  });

  describe("mapValue (sync)", () => {
    test("transforms results", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b"],
        results: [
          { id: "b", firstName: "Bob", lastName: "Smith" },
          { id: "a", firstName: "Alice", lastName: "Jones" },
        ],
        mapValue: (r) => `${r.firstName} ${r.lastName}`,
      });
      expect(result).toEqual(["Alice Jones", "Bob Smith"]);
    });

    test("undefined for missing keys", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b"],
        results: [{ id: "a", val: 1 }],
        mapValue: (r) => r.val * 10,
      });
      expect(result).toEqual([10, undefined]);
    });

    test("getKey + mapValue combined", async () => {
      const result = await prepareLoaderResult({
        keys: ["usr_1", "usr_2"],
        results: [
          { user_id: "usr_2", bio: "hello" },
          { user_id: "usr_1", bio: "world" },
        ],
        getKey: (r) => r.user_id,
        mapValue: (r) => ({ bio: r.bio }),
      });
      expect(result).toEqual([{ bio: "world" }, { bio: "hello" }]);
    });
  });

  describe("mapValue (async)", () => {
    test("async transform", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b"],
        results: [
          { id: "a", val: 1 },
          { id: "b", val: 2 },
        ],
        mapValue: async (r) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return r.val * 100;
        },
      });
      expect(result).toEqual([100, 200]);
    });

    test("async mapValue with missing keys", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b", "c"],
        results: [{ id: "b", val: 5 }],
        mapValue: async (r) => `async_${r.val}`,
      });
      expect(result).toEqual([undefined, "async_5", undefined]);
    });
  });

  describe("defaultValue", () => {
    test("null instead of undefined", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b"],
        results: [{ id: "a", val: 1 }],
        defaultValue: null,
      });
      expect(result).toEqual([{ id: "a", val: 1 }, null]);
    });

    test("custom default object", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b"],
        results: [{ id: "a", name: "Alice" }],
        defaultValue: { name: "Unknown" },
        mapValue: (r) => ({ name: r.name }),
      });
      expect(result).toEqual([{ name: "Alice" }, { name: "Unknown" }]);
    });

    test("empty array as default", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b"],
        results: [{ id: "a", tags: ["x"] }],
        defaultValue: [] as string[],
        mapValue: (r) => r.tags,
      });
      expect(result).toEqual([["x"], []]);
    });
  });

  describe("composite keys (keyToString)", () => {
    test("maps composite object keys", async () => {
      type Key = { object: string; objectId: string };
      const toStr = (k: Key) => `${k.object}::${k.objectId}`;
      const result = await prepareLoaderResult({
        keys: [
          { object: "booking", objectId: "1" },
          { object: "booking", objectId: "2" },
          { object: "user", objectId: "1" },
        ] as Key[],
        results: [
          { object: "user", objectId: "1", data: "user1" },
          { object: "booking", objectId: "1", data: "booking1" },
        ],
        getKey: (r) => ({ object: r.object, objectId: r.objectId }) as Key,
        keyToString: toStr,
      });
      expect(result).toEqual([
        { object: "booking", objectId: "1", data: "booking1" },
        undefined,
        { object: "user", objectId: "1", data: "user1" },
      ]);
    });
  });

  describe("one-to-many (mode: 'many')", () => {
    test("groups results by key", async () => {
      const result = await prepareLoaderResult({
        keys: ["user_1", "user_2", "user_3"],
        results: [
          { uid: "user_1", photo: "a.jpg" },
          { uid: "user_2", photo: "b.jpg" },
          { uid: "user_1", photo: "c.jpg" },
          { uid: "user_2", photo: "d.jpg" },
        ],
        mode: "many",
        getKey: (r) => r.uid,
      });
      expect(result).toEqual([
        [
          { uid: "user_1", photo: "a.jpg" },
          { uid: "user_1", photo: "c.jpg" },
        ],
        [
          { uid: "user_2", photo: "b.jpg" },
          { uid: "user_2", photo: "d.jpg" },
        ],
        [], // user_3 has no results
      ]);
    });

    test("empty array for keys with no results", async () => {
      const result = await prepareLoaderResult({
        keys: ["a", "b"],
        results: [],
        mode: "many",
      });
      expect(result).toEqual([[], []]);
    });

    test("with mapValue", async () => {
      const result = await prepareLoaderResult({
        keys: ["u1", "u2"],
        results: [
          { uid: "u1", file: "a.jpg", size: 100 },
          { uid: "u1", file: "b.jpg", size: 200 },
          { uid: "u2", file: "c.jpg", size: 300 },
        ],
        mode: "many",
        getKey: (r) => r.uid,
        mapValue: (r) => ({ file: r.file, size: r.size }),
      });
      expect(result).toEqual([
        [
          { file: "a.jpg", size: 100 },
          { file: "b.jpg", size: 200 },
        ],
        [{ file: "c.jpg", size: 300 }],
      ]);
    });

    test("with composite keys", async () => {
      type Key = { object: string; variant: string };
      const toStr = (k: Key) => `${k.object}::${k.variant}`;
      const result = await prepareLoaderResult({
        keys: [
          { object: "booking", variant: "photos" },
          { object: "booking", variant: "docs" },
        ] as Key[],
        results: [
          { object: "booking", variant: "photos", file: "1.jpg" },
          { object: "booking", variant: "photos", file: "2.jpg" },
          { object: "booking", variant: "docs", file: "contract.pdf" },
        ],
        mode: "many",
        getKey: (r) => ({ object: r.object, variant: r.variant }) as Key,
        keyToString: toStr,
      });
      expect(result).toEqual([
        [
          { object: "booking", variant: "photos", file: "1.jpg" },
          { object: "booking", variant: "photos", file: "2.jpg" },
        ],
        [{ object: "booking", variant: "docs", file: "contract.pdf" }],
      ]);
    });

    test("with async mapValue", async () => {
      const result = await prepareLoaderResult({
        keys: ["a"],
        results: [
          { id: "a", val: 1 },
          { id: "a", val: 2 },
        ],
        mode: "many",
        mapValue: async (r) => r.val * 10,
      });
      expect(result).toEqual([[10, 20]]);
    });
  });
});
