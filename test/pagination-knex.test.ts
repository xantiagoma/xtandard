import { describe, expect, test } from "vitest";
import { createKeysetSpec, keysetSqlExpression } from "../src/keyset.ts";
import { applyKeysetToKnex } from "../src/pagination-knex.ts";

class FakeKnexQuery {
  calls: Array<{ method: string; sql: string; bindings?: unknown[] }> = [];

  whereRaw(sql: string, bindings?: unknown[]): this {
    this.calls.push({ method: "whereRaw", sql, bindings });
    return this;
  }

  orderByRaw(sql: string): this {
    this.calls.push({ method: "orderByRaw", sql });
    return this;
  }
}

describe("applyKeysetToKnex", () => {
  const keyset = createKeysetSpec({
    sort: [
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ],
  });
  const columns = { createdAt: "created_at", id: "id" };

  test("applies whereRaw and orderByRaw", () => {
    const query = new FakeKnexQuery();
    const result = applyKeysetToKnex(
      query,
      keyset.where({ createdAt: "2024-01-01", id: 42 }, "forward"),
      keyset.orderBy("forward"),
      { columns },
    );

    expect(result).toBe(query);
    expect(query.calls).toEqual([
      {
        method: "whereRaw",
        sql: "(created_at > ?) OR (created_at = ? AND id > ?)",
        bindings: ["2024-01-01", "2024-01-01", 42],
      },
      { method: "orderByRaw", sql: "created_at ASC, id ASC" },
    ]);
  });

  test("skips whereRaw for first page", () => {
    const query = new FakeKnexQuery();
    applyKeysetToKnex(query, null, keyset.orderBy("forward"), { columns });

    expect(query.calls).toEqual([{ method: "orderByRaw", sql: "created_at ASC, id ASC" }]);
  });

  test("supports backward order and where", () => {
    const query = new FakeKnexQuery();
    applyKeysetToKnex(
      query,
      keyset.where({ createdAt: "2024-01-01", id: 42 }, "backward"),
      keyset.orderBy("backward"),
      { columns },
    );

    expect(query.calls).toEqual([
      {
        method: "whereRaw",
        sql: "(created_at < ?) OR (created_at = ? AND id < ?)",
        bindings: ["2024-01-01", "2024-01-01", 42],
      },
      { method: "orderByRaw", sql: "created_at DESC, id DESC" },
    ]);
  });

  test("does not interpolate cursor values", () => {
    const query = new FakeKnexQuery();
    const value = "x'); DROP TABLE posts; --";
    applyKeysetToKnex(
      query,
      keyset.where({ createdAt: value, id: 42 }, "forward"),
      keyset.orderBy(),
      {
        columns,
      },
    );

    expect(query.calls[0]?.sql).not.toContain(value);
    expect(query.calls[0]?.bindings).toContain(value);
  });

  test("rejects unsafe column identifiers", () => {
    const query = new FakeKnexQuery();
    expect(() =>
      applyKeysetToKnex(
        query,
        keyset.where({ createdAt: "x", id: 1 }, "forward"),
        keyset.orderBy(),
        {
          columns: { createdAt: "created_at; DROP TABLE posts", id: "id" },
        },
      ),
    ).toThrow(/invalid identifier/);
  });

  test("supports explicit SQL expressions", () => {
    const expr = createKeysetSpec({ sort: [{ key: "normalizedName" }, { key: "id" }] });
    const query = new FakeKnexQuery();
    applyKeysetToKnex(
      query,
      expr.where({ normalizedName: "SANTI MONTOYA", id: 7 }),
      expr.orderBy(),
      {
        columns: {
          normalizedName: keysetSqlExpression("upper(first_name || ' ' || last_name)"),
          id: "id",
        },
      },
    );

    expect(query.calls).toEqual([
      {
        method: "whereRaw",
        sql: "(upper(first_name || ' ' || last_name) > ?) OR (upper(first_name || ' ' || last_name) = ? AND id > ?)",
        bindings: ["SANTI MONTOYA", "SANTI MONTOYA", 7],
      },
      { method: "orderByRaw", sql: "upper(first_name || ' ' || last_name) ASC, id ASC" },
    ]);
  });
});
