import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createKeysetSpec } from "../src/keyset.ts";
import { createPaginator } from "../src/pagination.ts";
import { toSqlTagKeyset } from "../src/pagination-sql-tag.ts";
import { fakeSqlTag, startPglite } from "./sql-tag-helpers.ts";

describe("toSqlTagKeyset (recording tag)", () => {
  const keyset = createKeysetSpec({
    sort: [
      { key: "createdAt", order: "asc" },
      { key: "id", order: "asc" },
    ],
  });

  test("forward where + order by", () => {
    const { sql, render } = fakeSqlTag();
    const posts = toSqlTagKeyset(sql, { createdAt: "posts.created_at", id: "id" });

    expect(render(posts.where(keyset.where({ createdAt: "2024-01-01", id: 42 })))).toEqual({
      sql: '(("posts"."created_at" > ?) OR ("posts"."created_at" = ? AND "id" > ?))',
      bindings: ["2024-01-01", "2024-01-01", 42],
    });
    expect(render(posts.orderBy(keyset.orderBy()))).toEqual({
      sql: '"posts"."created_at" ASC, "id" ASC',
      bindings: [],
    });
  });

  test("backward flips the comparators and the order; first page → undefined", () => {
    const { sql, render } = fakeSqlTag();
    const posts = toSqlTagKeyset(sql, { createdAt: "created_at", id: "id" });

    expect(render(posts.where(keyset.where({ createdAt: "x", id: 1 }, "backward"))).sql).toBe(
      '(("created_at" < ?) OR ("created_at" = ? AND "id" < ?))',
    );
    expect(render(posts.orderBy(keyset.orderBy("backward"))).sql).toBe(
      '"created_at" DESC, "id" DESC',
    );
    expect(posts.where(keyset.where(null))).toBeUndefined();
  });

  test("a fragment target is embedded as it is; backticks on MySQL come from the client", () => {
    const { sql, render } = fakeSqlTag("mysql");
    const people = toSqlTagKeyset(sql, { name: sql`upper(${sql("name")})`, id: "people.id" });
    const spec = createKeysetSpec({ sort: [{ key: "name" }, { key: "id" }] });

    expect(render(people.where(spec.where({ name: "ADA", id: 7 })))).toEqual({
      sql: "((upper(`name`) > ?) OR (upper(`name`) = ? AND `people`.`id` > ?))",
      bindings: ["ADA", "ADA", 7],
    });
  });

  test("throws on a missing mapping or an unsafe column string", () => {
    const { sql } = fakeSqlTag();

    expect(() => toSqlTagKeyset(sql, { id: "id" }).orderBy(keyset.orderBy())).toThrow(
      'toSqlTagKeyset: missing column mapping for key "createdAt"',
    );
    expect(() =>
      toSqlTagKeyset(sql, { createdAt: "created_at; drop table posts", id: "id" }).orderBy(
        keyset.orderBy(),
      ),
    ).toThrow('toSqlTagKeyset: invalid SQL identifier "created_at; drop table posts"');
  });
});

describe("toSqlTagKeyset + createPaginator on a real Postgres (postgres.js + PGlite)", () => {
  let pg: Awaited<ReturnType<typeof startPglite>>;
  type Post = { id: number; created_at: Date };

  beforeAll(async () => {
    pg = await startPglite();
    await pg.sql`create table posts (id int primary key, created_at timestamptz not null)`;
    // Ties on created_at, so the id tiebreaker matters.
    for (let id = 1; id <= 7; id++) {
      const day = Math.ceil(id / 2);
      await pg.sql`insert into posts values (${id}, ${new Date(`2026-01-0${day}T00:00:00Z`)})`;
    }
  });
  afterAll(async () => {
    await pg?.stop();
  });

  const paginatorFor = (order: "asc" | "desc") => {
    const { sql } = pg;
    const keyset = createKeysetSpec({
      sort: [
        { key: "createdAt", order },
        { key: "id", order },
      ],
    });
    const posts = toSqlTagKeyset(sql, { createdAt: "posts.created_at", id: "posts.id" });

    return createPaginator({
      fetchCursor: async ({ limit, cursor, direction }) => {
        const where = posts.where(keyset.where(cursor, direction));
        const items = await sql<Post[]>`
          select id, created_at from posts
          ${where ? sql`where ${where}` : sql``}
          order by ${posts.orderBy(keyset.orderBy(direction))}
          limit ${limit}
        `;

        return { items: [...items] };
      },
      cursor: { fromItem: (p: Post) => ({ createdAt: p.created_at, id: p.id }) },
    });
  };

  test.each(["asc", "desc"] as const)("walks every page forward and back (%s)", async (order) => {
    const paginator = paginatorFor(order);
    const all = order === "asc" ? [1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1];

    const forward: number[][] = [];
    let cursor: string | null | undefined = null;
    let last;
    do {
      last = await paginator.paginate({ type: "cursor", limit: 3, cursor });
      forward.push(last.items.map((p) => p.id));
      cursor = last.pageInfo.endCursor;
    } while (last.pageInfo.hasNextPage);
    expect(forward).toEqual([all.slice(0, 3), all.slice(3, 6), all.slice(6)]);

    const back = await paginator.paginate({
      type: "cursor",
      limit: 3,
      cursor: last.pageInfo.startCursor,
      direction: "backward",
    });
    expect(back.items.map((p) => p.id)).toEqual(all.slice(3, 6));
  });
});
