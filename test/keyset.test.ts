import { describe, expect, test } from "vitest";
import {
  assertSqlIdentifier,
  createKeysetSpec,
  generateSubArrays,
  keysetSqlExpression,
  toKeysetOrderBySql,
  toKeysetWhereSql,
} from "../src/keyset.ts";

describe("generateSubArrays", () => {
  test("builds prefix arrays", () => {
    expect(generateSubArrays(["a", "b", "c"])).toEqual([["a"], ["a", "b"], ["a", "b", "c"]]);
  });

  test("empty input", () => {
    expect(generateSubArrays([])).toEqual([]);
  });
});

describe("createKeysetSpec", () => {
  const keyset = createKeysetSpec({
    sort: [
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ],
  });

  test("keys()", () => {
    expect(keyset.keys()).toEqual(["createdAt", "id"]);
  });

  test("orderBy forward", () => {
    expect(keyset.orderBy("forward")).toEqual([
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ]);
  });

  test("orderBy backward flips sort", () => {
    expect(keyset.orderBy("backward")).toEqual([
      { key: "createdAt", order: "desc" },
      { key: "id", order: "desc" },
    ]);
  });

  test("where null cursor → first page", () => {
    expect(keyset.where(null)).toBeNull();
    expect(keyset.where(undefined)).toBeNull();
  });

  test("where forward — lexicographic OR-of-ANDs", () => {
    const cursor = { createdAt: "2024-01-01", id: 42 };
    expect(keyset.where(cursor, "forward")).toEqual({
      or: [
        { and: [{ key: "createdAt", op: "gt", value: "2024-01-01" }] },
        {
          and: [
            { key: "createdAt", op: "eq", value: "2024-01-01" },
            { key: "id", op: "gt", value: 42 },
          ],
        },
      ],
    });
  });

  test("where backward — flipped comparators", () => {
    const cursor = { createdAt: "2024-01-01", id: 42 };
    expect(keyset.where(cursor, "backward")).toEqual({
      or: [
        { and: [{ key: "createdAt", op: "lt", value: "2024-01-01" }] },
        {
          and: [
            { key: "createdAt", op: "eq", value: "2024-01-01" },
            { key: "id", op: "lt", value: 42 },
          ],
        },
      ],
    });
  });

  test("three-column keyset", () => {
    const triple = createKeysetSpec({
      sort: [{ key: "lastName" }, { key: "firstName" }, { key: "id" }],
    });
    expect(triple.where({ lastName: "Doe", firstName: "Jane", id: 7 }, "forward")).toEqual({
      or: [
        { and: [{ key: "lastName", op: "gt", value: "Doe" }] },
        {
          and: [
            { key: "lastName", op: "eq", value: "Doe" },
            { key: "firstName", op: "gt", value: "Jane" },
          ],
        },
        {
          and: [
            { key: "lastName", op: "eq", value: "Doe" },
            { key: "firstName", op: "eq", value: "Jane" },
            { key: "id", op: "gt", value: 7 },
          ],
        },
      ],
    });
  });

  test("desc column — forward uses lt on last branch", () => {
    const desc = createKeysetSpec({ sort: [{ key: "score", order: "desc" }] });
    expect(desc.where({ score: 100 }, "forward")).toEqual({
      or: [{ and: [{ key: "score", op: "lt", value: 100 }] }],
    });
  });

  test("throws on missing cursor key", () => {
    expect(() => keyset.where({ createdAt: "2024-01-01" })).toThrow(/missing key "id"/);
  });

  test("throws on empty sort", () => {
    expect(() => createKeysetSpec({ sort: [] })).toThrow(/at least one column/);
  });

  test("defaults order to asc", () => {
    const spec = createKeysetSpec({ sort: [{ key: "id" }] });
    expect(spec.sort).toEqual([{ key: "id", order: "asc" }]);
  });
});

const columns = { createdAt: "created_at", id: "id" };

describe("toKeysetWhereSql", () => {
  const keyset = createKeysetSpec({
    sort: [
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ],
  });

  test("null where → empty fragment", () => {
    expect(toKeysetWhereSql(null, columns)).toEqual({ sql: "", params: [] });
  });

  test("parameterized OR-of-ANDs", () => {
    const where = keyset.where({ createdAt: "2024-01-01", id: 42 }, "forward");
    expect(toKeysetWhereSql(where, columns)).toEqual({
      sql: "(created_at > $1) OR (created_at = $2 AND id > $3)",
      params: ["2024-01-01", "2024-01-01", 42],
    });
  });

  test("custom placeholder style (? for MySQL)", () => {
    const where = keyset.where({ createdAt: "2024-01-01", id: 42 }, "forward");
    expect(toKeysetWhereSql(where, columns, { placeholder: () => "?" })).toEqual({
      sql: "(created_at > ?) OR (created_at = ? AND id > ?)",
      params: ["2024-01-01", "2024-01-01", 42],
    });
  });

  test("paramStart offset", () => {
    const single = createKeysetSpec({ sort: [{ key: "id" }] });
    expect(
      toKeysetWhereSql(single.where({ id: 1 }, "forward"), columns, {
        paramStart: 3,
      }),
    ).toEqual({ sql: "(id > $3)", params: [1] });
  });

  test("rejects unsafe column identifiers", () => {
    const where = keyset.where({ createdAt: "x", id: 1 }, "forward");
    expect(() =>
      toKeysetWhereSql(where, { createdAt: "created_at; DROP TABLE users", id: "id" }),
    ).toThrow(/invalid identifier/);
  });

  test("supports explicit SQL expressions", () => {
    const expr = createKeysetSpec({
      sort: [{ key: "normalizedName" }, { key: "id" }],
    });
    const columns = {
      normalizedName: keysetSqlExpression("upper(first_name || ' ' || last_name)"),
      id: "id",
    };
    const where = expr.where({ normalizedName: "SANTI MONTOYA", id: 7 });

    expect(toKeysetWhereSql(where, columns)).toEqual({
      sql: "(upper(first_name || ' ' || last_name) > $1) OR (upper(first_name || ' ' || last_name) = $2 AND id > $3)",
      params: ["SANTI MONTOYA", "SANTI MONTOYA", 7],
    });
    expect(toKeysetOrderBySql(expr.orderBy(), columns)).toBe(
      "upper(first_name || ' ' || last_name) ASC, id ASC",
    );
  });

  test("rejects missing column mapping", () => {
    const where = keyset.where({ createdAt: "x", id: 1 }, "forward");
    expect(() => toKeysetWhereSql(where, { id: "id" })).toThrow(/missing column mapping/);
  });
});

describe("toKeysetOrderBySql", () => {
  const keyset = createKeysetSpec({
    sort: [
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ],
  });

  test("forward order", () => {
    expect(toKeysetOrderBySql(keyset.orderBy("forward"), columns)).toBe("created_at ASC, id ASC");
  });

  test("backward flips direction", () => {
    expect(toKeysetOrderBySql(keyset.orderBy("backward"), columns)).toBe(
      "created_at DESC, id DESC",
    );
  });
});

describe("assertSqlIdentifier", () => {
  test("accepts valid identifiers", () => {
    expect(assertSqlIdentifier("created_at")).toBe("created_at");
    expect(assertSqlIdentifier("_private")).toBe("_private");
  });

  test("rejects injection attempts", () => {
    expect(() => assertSqlIdentifier("id; DROP TABLE")).toThrow(/invalid identifier/);
    expect(() => assertSqlIdentifier("")).toThrow(/invalid identifier/);
  });
});
