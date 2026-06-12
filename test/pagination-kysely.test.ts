import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
} from "kysely";
import { describe, expect, test } from "vitest";
import { assertNotNull } from "../src/assert-not-null.ts";
import { createKeysetSpec } from "../src/keyset.ts";
import { toKyselyKeyset } from "../src/pagination-kysely.ts";

type DB = {
  posts: {
    id: number;
    created_at: Date;
    first_name: string;
    last_name: string;
  };
};

const db = new Kysely<DB>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (database) => new PostgresIntrospector(database),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

describe("toKyselyKeyset", () => {
  const keyset = createKeysetSpec({
    sort: [
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ],
  });

  test("renders where SQL", () => {
    const kyselyKeyset = toKyselyKeyset({ createdAt: "posts.created_at", id: "posts.id" });
    const where = assertNotNull(
      kyselyKeyset.where(keyset.where({ createdAt: new Date("2024-01-01"), id: 42 })),
    );
    const compiled = db.selectFrom("posts").selectAll().where(where).compile();

    expect(compiled.sql).toBe(
      'select * from "posts" where (("posts"."created_at" > $1) or ("posts"."created_at" = $2 and "posts"."id" > $3))',
    );
    expect(compiled.parameters).toEqual([new Date("2024-01-01"), new Date("2024-01-01"), 42]);
  });

  test("first page where is undefined", () => {
    const kyselyKeyset = toKyselyKeyset({ createdAt: "posts.created_at", id: "posts.id" });
    expect(kyselyKeyset.where(null)).toBeUndefined();
  });

  test("renders order by", () => {
    const kyselyKeyset = toKyselyKeyset({ createdAt: "posts.created_at", id: "posts.id" });
    const [createdAt, id] = kyselyKeyset.orderBy(keyset.orderBy("backward"));
    const compiled = db
      .selectFrom("posts")
      .selectAll()
      .orderBy(assertNotNull(createdAt))
      .orderBy(assertNotNull(id))
      .compile();

    expect(compiled.sql).toBe(
      'select * from "posts" order by "posts"."created_at" desc, "posts"."id" desc',
    );
  });

  test("supports SQL expression mappings", () => {
    const expr = createKeysetSpec({ sort: [{ key: "normalizedName" }, { key: "id" }] });
    const kyselyKeyset = toKyselyKeyset({
      normalizedName: sql<string>`upper(first_name || ' ' || last_name)`,
      id: "posts.id",
    });
    const where = assertNotNull(kyselyKeyset.where(expr.where({ normalizedName: "SANTI", id: 7 })));
    const compiled = db.selectFrom("posts").selectAll().where(where).compile();

    expect(compiled.sql).toBe(
      `select * from "posts" where ((upper(first_name || ' ' || last_name) > $1) or (upper(first_name || ' ' || last_name) = $2 and "posts"."id" > $3))`,
    );
    expect(compiled.parameters).toEqual(["SANTI", "SANTI", 7]);
  });

  test("throws on missing column mapping", () => {
    const kyselyKeyset = toKyselyKeyset({ id: "posts.id" });
    expect(() => kyselyKeyset.where(keyset.where({ createdAt: "x", id: 1 }))).toThrow(
      /missing column mapping/,
    );
  });
});
