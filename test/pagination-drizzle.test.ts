import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core/dialect";
import { describe, expect, test } from "vitest";
import { assertNotNull } from "../src/assert-not-null.ts";
import { createKeysetSpec } from "../src/keyset.ts";
import { toDrizzleKeyset } from "../src/pagination-drizzle.ts";

const posts = pgTable("posts", {
  id: integer("id"),
  createdAt: timestamp("created_at"),
  firstName: text("first_name"),
  lastName: text("last_name"),
});

const dialect = new PgDialect();

const render = (statement: ReturnType<typeof sql>) => dialect.sqlToQuery(statement);

describe("toDrizzleKeyset", () => {
  const keyset = createKeysetSpec({
    sort: [
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ],
  });

  test("renders where SQL", () => {
    const drizzleKeyset = toDrizzleKeyset({ createdAt: posts.createdAt, id: posts.id });
    const where = drizzleKeyset.where(keyset.where({ createdAt: new Date("2024-01-01"), id: 42 }));

    const definedWhere = assertNotNull(where);
    expect(render(definedWhere).sql).toBe(
      '("posts"."created_at" > $1 or ("posts"."created_at" = $2 and "posts"."id" > $3))',
    );
    expect(render(definedWhere).params).toEqual([
      "2024-01-01T00:00:00.000Z",
      "2024-01-01T00:00:00.000Z",
      42,
    ]);
  });

  test("first page where is undefined", () => {
    const drizzleKeyset = toDrizzleKeyset({ createdAt: posts.createdAt, id: posts.id });
    expect(drizzleKeyset.where(null)).toBeUndefined();
  });

  test("renders order by", () => {
    const drizzleKeyset = toDrizzleKeyset({ createdAt: posts.createdAt, id: posts.id });
    const order = drizzleKeyset.orderBy(keyset.orderBy("backward"));

    expect(order.map((item) => render(item).sql)).toEqual([
      '"posts"."created_at" desc',
      '"posts"."id" desc',
    ]);
  });

  test("supports SQL expression mappings", () => {
    const expr = createKeysetSpec({ sort: [{ key: "normalizedName" }, { key: "id" }] });
    const drizzleKeyset = toDrizzleKeyset({
      normalizedName: sql<string>`upper(${posts.firstName} || ' ' || ${posts.lastName})`,
      id: posts.id,
    });
    const where = drizzleKeyset.where(expr.where({ normalizedName: "SANTI MONTOYA", id: 7 }));

    expect(render(assertNotNull(where)).sql).toBe(
      `(upper("posts"."first_name" || ' ' || "posts"."last_name") > $1 or (upper("posts"."first_name" || ' ' || "posts"."last_name") = $2 and "posts"."id" > $3))`,
    );
    expect(render(where!).params).toEqual(["SANTI MONTOYA", "SANTI MONTOYA", 7]);
  });

  test("throws on missing column mapping", () => {
    const drizzleKeyset = toDrizzleKeyset({ id: posts.id });
    expect(() => drizzleKeyset.where(keyset.where({ createdAt: "x", id: 1 }))).toThrow(
      /missing column mapping/,
    );
  });
});
