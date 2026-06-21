import { describe, expect, test } from "vitest";

import { createKeysetSpec } from "../src/keyset.ts";
import { toDrizzleRqbKeyset } from "../src/pagination-drizzle-rqb.ts";

const keyset = createKeysetSpec({
  sort: [
    { key: "createdAt", order: "desc" },
    { key: "id", order: "asc" },
  ],
});
const rqb = toDrizzleRqbKeyset({ createdAt: "createdAt", id: "id" });

describe("toDrizzleRqbKeyset", () => {
  test("orderBy → RQBv2 object, insertion-ordered, directions preserved", () => {
    expect(rqb.orderBy(keyset.orderBy("forward"))).toEqual({ createdAt: "desc", id: "asc" });
    // backward flips directions
    expect(rqb.orderBy(keyset.orderBy("backward"))).toEqual({ createdAt: "asc", id: "desc" });
  });

  test("null where (first page) → undefined", () => {
    expect(rqb.where(keyset.where(null, "forward"))).toBeUndefined();
  });

  test("cursor where → OR of AND-ed column seeks (eq/gt/lt)", () => {
    const cursor = { createdAt: "2026-02-14T00:00:00Z", id: "abc" };
    const where = rqb.where(keyset.where(cursor, "forward"));

    expect(where).toHaveProperty("OR");
    const or = (where as { OR: { AND: Record<string, unknown>[] }[] }).OR;
    expect(Array.isArray(or)).toBe(true);
    // every branch is an { AND: [ { col: { eq|gt|lt } }, … ] }
    for (const branch of or) {
      expect(Array.isArray(branch.AND)).toBe(true);
      for (const term of branch.AND) {
        const col = Object.keys(term)[0] ?? "";
        expect(["createdAt", "id"]).toContain(col);
        const cond = term[col];
        const op = Object.keys(cond ?? {})[0];
        expect(["eq", "gt", "lt"]).toContain(op);
      }
    }
  });

  test("missing column mapping throws", () => {
    const bad = toDrizzleRqbKeyset({ createdAt: "createdAt" }); // no `id`
    expect(() => bad.orderBy(keyset.orderBy("forward"))).toThrow();
  });
});
