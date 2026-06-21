import { parsePaginationParams } from "../src/entry-pagination.ts";
import { describe, expect, test } from "vitest";
import { PgDialect, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { combineWhere, createDrizzleKeyset } from "../src/filters/drizzle/pagination.ts";

const tbl = pgTable("tbl", {
  id: text("id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }),
});

const dialect = new PgDialect();

describe("parsePaginationParams (transport → normalized input)", () => {
  test("detects page / offset / cursor styles", () => {
    expect(parsePaginationParams({ page: 3, per_page: 25 })).toMatchObject({
      type: "page",
      page: 3,
      pageSize: 25,
    });
    expect(parsePaginationParams({ limit: 10, offset: 40 })).toMatchObject({
      type: "offset",
      limit: 10,
      offset: 40,
    });
    expect(parsePaginationParams({ cursor: "abc" })).toMatchObject({
      type: "cursor",
      cursor: "abc",
    });
  });

  test("clamps an oversized page size", () => {
    const parsed = parsePaginationParams({ page: 1, per_page: 10_000 }, { maxPageSize: 100 });

    expect(parsed).toMatchObject({ type: "page", pageSize: 100 });
  });
});

describe("createDrizzleKeyset", () => {
  const keyset = createDrizzleKeyset({
    sort: [
      { key: "createdAt", order: "desc" },
      { key: "id", order: "desc" },
    ],
    columns: { createdAt: tbl.createdAt, id: tbl.id },
  });

  test("keys() reflects the sort order", () => {
    expect(keyset.keys()).toEqual(["createdAt", "id"]);
  });

  test("orderBy renders DESC order keys", () => {
    const order = keyset.orderBy("forward");
    const sql = order.map((o) => dialect.sqlToQuery(o).sql.toLowerCase()).join(", ");

    expect(sql).toContain("desc");
  });

  test("where renders a lexicographic seek for a cursor position", () => {
    const seek = keyset.where(
      { createdAt: new Date("2026-06-18T00:00:00Z"), id: "run_x" },
      "forward",
    );

    expect(seek).toBeDefined();
    const q = seek ? dialect.sqlToQuery(seek) : null;
    expect(q?.sql.toLowerCase()).toContain(" or ");
    expect(q?.params).toHaveLength(3); // (a<x) OR (a=x AND b<y) → 3 bound params
  });

  test("first page (null cursor) has no seek", () => {
    expect(keyset.where(null, "forward")).toBeUndefined();
  });
});

describe("combineWhere", () => {
  test("ANDs defined conditions and drops undefined", () => {
    const seek = createDrizzleKeyset({
      sort: [{ key: "id", order: "asc" }],
      columns: { id: tbl.id },
    }).where({ id: "x" });

    expect(combineWhere(undefined, undefined)).toBeUndefined();
    expect(combineWhere(seek, undefined)).toBeDefined();
  });
});
