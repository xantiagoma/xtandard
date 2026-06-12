import { describe, expect, test } from "vitest";
import { createKeysetSpec } from "../src/keyset.ts";
import { assertPrismaField, toPrismaKeyset } from "../src/pagination-prisma.ts";

describe("toPrismaKeyset", () => {
  const keyset = createKeysetSpec({
    sort: [
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ],
  });
  const prismaKeyset = toPrismaKeyset({ createdAt: "createdAt", id: "id" });

  test("renders where object", () => {
    expect(prismaKeyset.where(keyset.where({ createdAt: "2024-01-01", id: 42 }))).toEqual({
      OR: [
        { createdAt: { gt: "2024-01-01" } },
        {
          AND: [{ createdAt: { equals: "2024-01-01" } }, { id: { gt: 42 } }],
        },
      ],
    });
  });

  test("first page where is undefined", () => {
    expect(prismaKeyset.where(null)).toBeUndefined();
  });

  test("renders backward where and orderBy", () => {
    expect(
      prismaKeyset.where(keyset.where({ createdAt: "2024-01-01", id: 42 }, "backward")),
    ).toEqual({
      OR: [
        { createdAt: { lt: "2024-01-01" } },
        {
          AND: [{ createdAt: { equals: "2024-01-01" } }, { id: { lt: 42 } }],
        },
      ],
    });
    expect(prismaKeyset.orderBy(keyset.orderBy("backward"))).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  test("throws on missing field mapping", () => {
    const missing = toPrismaKeyset({ id: "id" });
    expect(() => missing.where(keyset.where({ createdAt: "x", id: 1 }))).toThrow(
      /missing field mapping/,
    );
  });

  test("validates field names", () => {
    expect(assertPrismaField("createdAt")).toBe("createdAt");
    expect(() => assertPrismaField("createdAt;deleteMany")).toThrow(/invalid field/);
    expect(() =>
      toPrismaKeyset({ createdAt: "createdAt;deleteMany", id: "id" }).orderBy(keyset.orderBy()),
    ).toThrow(/invalid field/);
  });
});
