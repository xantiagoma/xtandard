import { describe, expect, test } from "vitest";
import { PgDialect, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { buildOrderBy } from "../src/filters/drizzle/sort.ts";
import { OPERATORS_BY_KIND } from "../src/filters/resource-metadata.ts";
import { parseSortParam, serializeSort } from "../src/filters/sort.ts";

const tbl = pgTable("tbl", {
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }),
});

const dialect = new PgDialect();

describe("parseSortParam / serializeSort", () => {
  test("parses a compact multi-field sort", () => {
    expect(parseSortParam({ value: "createdAt:desc,name:asc" }).sort).toEqual([
      { field: "createdAt", dir: "desc" },
      { field: "name", dir: "asc" },
    ]);
  });

  test("defaults missing/invalid direction to desc and round-trips", () => {
    const { sort } = parseSortParam({ value: "name" });
    expect(sort).toEqual([{ field: "name", dir: "desc" }]);
    expect(serializeSort({ sort })).toBe("name:desc");
  });

  test("empty input → []", () => {
    expect(parseSortParam({ value: undefined }).sort).toEqual([]);
  });
});

describe("buildOrderBy", () => {
  const columns = { name: tbl.name, createdAt: tbl.createdAt };

  test("allow-lists sortable columns and emits asc/desc", () => {
    const { orderBy } = buildOrderBy({
      sort: [
        { field: "createdAt", dir: "desc" },
        { field: "secret", dir: "asc" }, // not allow-listed → dropped
      ],
      columns,
    });

    const [first] = orderBy;
    expect(first).toBeDefined();
    if (first) expect(dialect.sqlToQuery(first).sql.toLowerCase()).toContain("desc");
  });

  test("falls back to defaultSort when nothing resolves", () => {
    const { orderBy } = buildOrderBy({
      sort: [{ field: "nope", dir: "asc" }],
      columns,
      defaultSort: [{ field: "createdAt", dir: "asc" }],
    });

    const [first] = orderBy;
    expect(first).toBeDefined();
    if (first) expect(dialect.sqlToQuery(first).sql.toLowerCase()).toContain("asc");
  });
});

describe("OPERATORS_BY_KIND", () => {
  test("exposes drizzle-aligned operators per kind", () => {
    expect(OPERATORS_BY_KIND.text).toContain("contains");
    expect(OPERATORS_BY_KIND.number).toContain("between");
    expect(OPERATORS_BY_KIND.enum).toContain("inArray");
    expect(OPERATORS_BY_KIND.date).toContain("is");
    expect(OPERATORS_BY_KIND.boolean).toContain("eq");
  });
});
