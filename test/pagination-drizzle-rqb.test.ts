import { describe, expect, test } from "vitest";

import { createKeysetSpec } from "../src/keyset.ts";
import {
  type RqbV1KeysetOperators,
  type RqbV1OrderOperators,
  toDrizzleRqbKeyset,
  toDrizzleRqbV1Keyset,
} from "../src/pagination-drizzle-rqb.ts";

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

describe("toDrizzleRqbV1Keyset (legacy callbacks)", () => {
  type Node = { op: string; args: unknown[] };
  const whereOps: RqbV1KeysetOperators<Node> = {
    eq: (c, v) => ({ op: "eq", args: [c, v] }),
    gt: (c, v) => ({ op: "gt", args: [c, v] }),
    lt: (c, v) => ({ op: "lt", args: [c, v] }),
    and: (...xs) => ({ op: "and", args: xs.filter((x) => x !== undefined) }),
    or: (...xs) => ({ op: "or", args: xs.filter((x) => x !== undefined) }),
  };
  const orderOps: RqbV1OrderOperators<Node> = {
    asc: (c) => ({ op: "asc", args: [c] }),
    desc: (c) => ({ op: "desc", args: [c] }),
  };
  const fields = { createdAt: "F.createdAt", id: "F.id" };
  const rqbV1 = toDrizzleRqbV1Keyset({ createdAt: "createdAt", id: "id" });

  test("orderBy callback → ordered asc/desc via the provided ops + fields", () => {
    const cb = rqbV1.orderBy(keyset.orderBy("forward"));
    expect(cb(fields, orderOps)).toEqual([
      { op: "desc", args: ["F.createdAt"] },
      { op: "asc", args: ["F.id"] },
    ]);
  });

  test("null where → undefined (first page)", () => {
    expect(rqbV1.where(keyset.where(null, "forward"))).toBeUndefined();
  });

  test("cursor where callback → or(and(...)) of eq/gt/lt via ops + fields", () => {
    const cb = rqbV1.where(
      keyset.where({ createdAt: "2026-02-14T00:00:00Z", id: "abc" }, "forward"),
    );
    const result = cb?.(fields, whereOps);

    expect(result?.op).toBe("or");
    for (const branch of (result?.args ?? []) as Node[]) {
      expect(branch.op).toBe("and");
      for (const term of branch.args as Node[]) {
        expect(["eq", "gt", "lt"]).toContain(term.op);
        expect(["F.createdAt", "F.id"]).toContain(term.args[0]);
      }
    }
  });
});
