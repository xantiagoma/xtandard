import { describe, expect, test } from "vitest";
import { createKeysetSpec } from "../src/keyset.ts";
import { assertMongoFieldPath, toMongoKeyset } from "../src/pagination-mongo.ts";

describe("toMongoKeyset", () => {
  const keyset = createKeysetSpec({
    sort: [
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ],
  });
  const mongoKeyset = toMongoKeyset({ createdAt: "createdAt", id: "_id" });

  test("renders filter object", () => {
    expect(mongoKeyset.filter(keyset.where({ createdAt: "2024-01-01", id: 42 }))).toEqual({
      $or: [
        { createdAt: { $gt: "2024-01-01" } },
        {
          $and: [{ createdAt: "2024-01-01" }, { _id: { $gt: 42 } }],
        },
      ],
    });
  });

  test("first page filter is undefined", () => {
    expect(mongoKeyset.filter(null)).toBeUndefined();
  });

  test("renders backward filter and sort", () => {
    expect(
      mongoKeyset.filter(keyset.where({ createdAt: "2024-01-01", id: 42 }, "backward")),
    ).toEqual({
      $or: [
        { createdAt: { $lt: "2024-01-01" } },
        {
          $and: [{ createdAt: "2024-01-01" }, { _id: { $lt: 42 } }],
        },
      ],
    });
    expect(mongoKeyset.sort(keyset.orderBy("backward"))).toEqual({
      createdAt: -1,
      _id: -1,
    });
  });

  test("supports dotted field paths", () => {
    const nested = toMongoKeyset({ authorName: "author.name", id: "_id" });
    const nestedKeyset = createKeysetSpec({ sort: [{ key: "authorName" }, { key: "id" }] });

    expect(nested.filter(nestedKeyset.where({ authorName: "Santi", id: 1 }))).toEqual({
      $or: [
        { "author.name": { $gt: "Santi" } },
        { $and: [{ "author.name": "Santi" }, { _id: { $gt: 1 } }] },
      ],
    });
  });

  test("throws on missing field mapping", () => {
    const missing = toMongoKeyset({ id: "_id" });
    expect(() => missing.filter(keyset.where({ createdAt: "x", id: 1 }))).toThrow(
      /missing field mapping/,
    );
  });

  test("validates field paths", () => {
    expect(assertMongoFieldPath("author.name")).toBe("author.name");
    expect(() => assertMongoFieldPath("$where")).toThrow(/invalid field path/);
    expect(() => assertMongoFieldPath("author..name")).toThrow(/invalid field path/);
  });
});
