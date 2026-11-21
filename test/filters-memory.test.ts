import { describe, expect, test } from "vitest";

import type { ColumnFilter, CompiledWhere } from "../src/filters/types.ts";
import {
  applyFiltersToArray,
  arrayField,
  booleanField,
  buildComparator,
  buildFilterNodePredicate,
  buildFilterPredicate,
  createMemoryKeyset,
  createMemoryPaginator,
  dateField,
  enumField,
  numberField,
  textField,
  toFilterPredicate,
  type MemoryDialect,
} from "../src/entry-filters-memory.ts";

const cond = (c: Record<string, unknown>): CompiledWhere =>
  ({ type: "cond", cond: c }) as CompiledWhere;
const where = (w: CompiledWhere, dialect?: MemoryDialect) =>
  toFilterPredicate({ where: w, paths: { x: "x" }, dialect });
const matches = (w: CompiledWhere, x: unknown, dialect?: MemoryDialect) => where(w, dialect)({ x });

// ── the JSDoc examples, verbatim ───────────────────────────────────────────

describe("JSDoc examples", () => {
  test("dateField", () => {
    const resolveDate = () => ({
      start: new Date("2026-01-01T00:00:00Z"),
      end: new Date("2026-02-01T00:00:00Z"),
    });
    const { predicate } = buildFilterPredicate({
      spec: { createdAt: dateField({ path: "createdAt" }) },
      filters: [
        {
          field: "createdAt",
          filter: {
            kind: "date",
            operator: "is",
            unit: "month",
            timeZone: "UTC",
            anchor: "2026-01-15T00:00:00",
          },
        },
      ],
      resolveDate,
    });
    expect(predicate({ createdAt: new Date("2026-01-31T23:59:59Z") })).toBe(true);
    expect(predicate({ createdAt: "2026-02-01T00:00:00Z" })).toBe(false);
    expect(predicate({ createdAt: null })).toBe(false);
  });

  test("textField", () => {
    const { predicate } = buildFilterPredicate({
      spec: { city: textField({ path: "address.city" }) },
      filters: [{ field: "city", filter: { kind: "text", operator: "contains", value: "LIM" } }],
    });
    expect(predicate({ address: { city: "Lima" } })).toBe(true);
    expect(predicate({ address: null })).toBe(false);
  });

  test("numberField", () => {
    const { predicate } = buildFilterPredicate({
      spec: { total: numberField({ path: (order: { cents: number }) => order.cents / 100 }) },
      filters: [
        { field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } },
      ],
    });
    expect(predicate({ cents: 1999 })).toBe(true);
    expect(predicate({ cents: 2001 })).toBe(false);
  });

  test("enumField", () => {
    const { predicate } = buildFilterPredicate({
      spec: { status: enumField({ path: "status" }) },
      filters: [
        { field: "status", filter: { kind: "enum", operator: "notInArray", values: ["done"] } },
      ],
    });
    expect(predicate({ status: "open" })).toBe(true);
    expect(predicate({ status: null })).toBe(false);
  });

  test("booleanField", () => {
    const { predicate } = buildFilterPredicate({
      spec: { done: booleanField({ path: "done" }) },
      filters: [{ field: "done", filter: { kind: "boolean", operator: "ne", value: true } }],
    });
    expect(predicate({ done: false })).toBe(true);
    expect(predicate({})).toBe(false);
  });

  test("arrayField", () => {
    const { predicate } = buildFilterPredicate({
      spec: { tags: arrayField({ path: "tags" }) },
      filters: [
        {
          field: "tags",
          filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] },
        },
      ],
    });
    expect(predicate({ tags: ["go", "ts"] })).toBe(true);
    expect(predicate({ tags: [] })).toBe(false);
  });

  test("toFilterPredicate", () => {
    const predicate = toFilterPredicate({
      where: {
        type: "not",
        node: { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
      },
      paths: { amount: "amount" },
    });
    expect(predicate({ amount: 3 })).toBe(true);
    expect(predicate({ amount: 9 })).toBe(false);
    expect(predicate({ amount: null })).toBe(false);
  });

  test("buildFilterPredicate", () => {
    type Task = { name: string; amount: number | null };
    const tasks: Task[] = [
      { name: "Rent", amount: 1200 },
      { name: "Refund", amount: null },
      { name: "Groceries", amount: 150 },
    ];
    const spec = { name: textField({ path: "name" }), amount: numberField({ path: "amount" }) };
    const filters: ColumnFilter[] = [
      { field: "name", filter: { kind: "text", operator: "startsWith", value: "re" } },
      { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
    ];
    const { predicate } = buildFilterPredicate<Task>({ spec, filters });
    expect(tasks.filter(predicate).map((t) => t.name)).toEqual(["Rent"]);
  });

  test("buildFilterNodePredicate", () => {
    const spec = { name: textField({ path: "name" }), amount: numberField({ path: "amount" }) };
    const { predicate } = buildFilterNodePredicate({
      spec,
      node: {
        type: "or",
        nodes: [
          {
            type: "column",
            field: "name",
            filter: { kind: "text", operator: "eq", value: "Rent" },
          },
          {
            type: "not",
            node: {
              type: "column",
              field: "amount",
              filter: { kind: "number", operator: "lt", value: 0 },
            },
          },
        ],
      },
    });
    expect(predicate({ name: "Rent", amount: -5 })).toBe(true);
    expect(predicate({ name: "Fee", amount: 10 })).toBe(true);
    expect(predicate({ name: "Fee", amount: null })).toBe(false);
  });

  test("applyFiltersToArray", () => {
    const rows = [
      { id: 1, status: "open" },
      { id: 2, status: "done" },
      { id: 3, status: null },
    ];
    expect(
      applyFiltersToArray(rows, {
        spec: { status: enumField({ path: "status" }) },
        filters: [{ field: "status", filter: { kind: "enum", operator: "ne", value: "done" } }],
      }).map((r) => r.id),
    ).toEqual([1]);
  });

  test("buildComparator", () => {
    const rows = [
      { id: 1, name: "b", amount: 5 },
      { id: 2, name: "a", amount: null },
      { id: 3, name: "c", amount: 5 },
    ];
    const { compare } = buildComparator({
      sort: [
        { field: "amount", dir: "desc" },
        { field: "password", dir: "asc" },
      ],
      paths: { name: "name", amount: "amount" },
      defaultSort: [{ field: "name", dir: "asc" }],
    });
    expect([...rows].sort(compare).map((r) => r.id)).toEqual([2, 1, 3]);
  });

  test("createMemoryKeyset", () => {
    const rows = [
      { id: 3, at: 10 },
      { id: 1, at: 20 },
      { id: 2, at: 10 },
    ];
    const keyset = createMemoryKeyset({
      sort: [
        { key: "at", order: "desc" },
        { key: "id", order: "asc" },
      ],
    });
    const sorted = [...rows].sort(keyset.compare());
    expect(sorted.map((r) => r.id)).toEqual([1, 2, 3]);
    const after = keyset.where(keyset.fromItem(sorted[0]!))!;
    expect(sorted.filter(after).map((r) => r.id)).toEqual([2, 3]);
    expect(keyset.where(null)).toBeUndefined();
  });

  test("createMemoryPaginator", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `task ${5 - i}` }));
    const paginator = createMemoryPaginator({
      rows,
      sort: [
        { key: "name", order: "asc" },
        { key: "id", order: "asc" },
      ],
    });
    const first = paginator.paginate({ type: "cursor", limit: 2 });
    expect(first.items.map((r) => r.name)).toEqual(["task 1", "task 2"]);
    const next = paginator.paginate({ type: "cursor", limit: 2, cursor: first.pageInfo.endCursor });
    expect(next.items.map((r) => r.name)).toEqual(["task 3", "task 4"]);
    expect(paginator.paginate({ type: "page", page: 3, pageSize: 2 }).pageInfo).toEqual({
      hasNextPage: false,
      hasPreviousPage: true,
      page: 3,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
      startCursor: expect.any(String),
      endCursor: expect.any(String),
    });
  });
});

// ── semantics ──────────────────────────────────────────────────────────────

describe("three-valued NULL logic", () => {
  const gt5 = cond({ field: "x", op: "gt", value: 5 });
  const isNullX = cond({ field: "x", op: "isNull" });

  test("comparisons with NULL (or a missing value) are UNKNOWN, and NOT UNKNOWN stays UNKNOWN", () => {
    for (const x of [null, undefined]) {
      expect(matches(gt5, x)).toBe(false);
      expect(matches({ type: "not", node: gt5 }, x)).toBe(false);
      expect(matches(cond({ field: "x", op: "ne", value: 1 }), x)).toBe(false);
    }
    expect(toFilterPredicate({ where: gt5, paths: { x: "x" } })({})).toBe(false);
  });

  test("AND/OR: FALSE and TRUE dominate UNKNOWN", () => {
    const and = (nodes: CompiledWhere[]): CompiledWhere => ({ type: "and", nodes });
    const or = (nodes: CompiledWhere[]): CompiledWhere => ({ type: "or", nodes });
    // x NULL: gt5 UNKNOWN, isNull TRUE
    expect(matches(or([gt5, isNullX]), null)).toBe(true);
    expect(matches(and([gt5, isNullX]), null)).toBe(false);
    // NOT (UNKNOWN AND FALSE) = NOT FALSE = TRUE
    expect(matches({ type: "not", node: and([gt5, { type: "not", node: isNullX }]) }, null)).toBe(
      true,
    );
    // NOT (UNKNOWN OR FALSE) = NOT UNKNOWN = UNKNOWN
    expect(matches({ type: "not", node: or([gt5, { type: "not", node: isNullX }]) }, null)).toBe(
      false,
    );
  });

  test("IN / NOT IN with NULLs on either side", () => {
    const inList = (values: unknown[]) => cond({ field: "x", op: "inArray", values });
    const notIn = (values: unknown[]) => cond({ field: "x", op: "notInArray", values });
    expect(matches(inList([1, null]), 1)).toBe(true);
    expect(matches(inList([1, null]), 2)).toBe(false); // UNKNOWN
    expect(matches(notIn([1, null]), 2)).toBe(false); // never TRUE with a NULL in the list
    expect(matches(notIn([1]), 2)).toBe(true);
    expect(matches(notIn([1]), null)).toBe(false);
    // an empty list is FALSE / TRUE even for NULL (SQLite `IN ()`, drizzle's `false`/`true`)
    expect(matches(inList([]), null)).toBe(false);
    expect(matches(notIn([]), null)).toBe(true);
  });

  test("text matches on NULL are UNKNOWN (notIlike never matches NULL)", () => {
    expect(matches(cond({ field: "x", op: "notIlike", value: "a%" }), null)).toBe(false);
    expect(matches(cond({ field: "x", op: "notIlike", value: "a%" }), "b")).toBe(true);
  });

  test("values of different types are incomparable: UNKNOWN, even under NOT", () => {
    const eq5 = cond({ field: "x", op: "eq", value: 5 });
    expect(matches(eq5, "5")).toBe(false);
    expect(matches({ type: "not", node: eq5 }, "5")).toBe(false);
    expect(matches(eq5, 5n)).toBe(true); // bigint vs number compares numerically
  });
});

describe("LIKE", () => {
  const like = (op: string, value: string, x: unknown, dialect?: MemoryDialect) =>
    matches(cond({ field: "x", op, value }), x, dialect);

  test("% and _ wildcards over code points, \\ escapes", () => {
    expect(like("like", "a%c", "abbbc")).toBe(true);
    expect(like("like", "a_c", "abc")).toBe(true);
    expect(like("like", "a_c", "abbc")).toBe(false);
    expect(like("like", "_", "😀")).toBe(true); // one character, not one UTF-16 unit
    expect(like("like", "a\\%", "a%")).toBe(true);
    expect(like("like", "a\\%", "ab")).toBe(false);
    expect(like("like", "a\\\\b", "a\\b")).toBe(true);
    expect(like("like", "%a%b%", "xxaybz")).toBe(true);
    expect(like("like", "%", "")).toBe(true);
    expect(like("like", "a\\", "a\\")).toBe(true); // trailing escape is a literal backslash
  });

  test("contains/startsWith/endsWith match the input literally", () => {
    expect(like("contains", "50%", "50% off")).toBe(true);
    expect(like("contains", "50%", "500 off")).toBe(false);
    expect(like("startsWith", "a_", "a_b")).toBe(true);
    expect(like("startsWith", "a_", "axb")).toBe(false);
    expect(like("endsWith", "\\x", "a\\x")).toBe(true);
  });

  test("postgres: like is case-sensitive, ilike folds Unicode", () => {
    expect(like("like", "ada", "Ada")).toBe(false);
    expect(like("ilike", "ada", "Ada")).toBe(true);
    expect(like("contains", "école", "ÉCOLE")).toBe(true);
  });

  test("sqlite: like and ilike both fold ASCII only", () => {
    expect(like("like", "ada", "Ada", "sqlite")).toBe(true);
    expect(like("ilike", "ADA", "ada", "sqlite")).toBe(true);
    expect(like("contains", "école", "ÉCOLE", "sqlite")).toBe(false);
  });

  test("numbers are matched by their text", () => {
    expect(like("startsWith", "12", 123)).toBe(true);
  });
});

describe("dates", () => {
  const at = new Date("2026-03-01T00:00:00Z");
  const gte = cond({ field: "x", op: "gte", value: at });

  test("a Date condition accepts Date, ISO string, epoch ms and Temporal-like row values", () => {
    expect(matches(gte, new Date("2026-03-02T00:00:00Z"))).toBe(true);
    expect(matches(gte, "2026-03-02T00:00:00Z")).toBe(true);
    expect(matches(gte, at.getTime())).toBe(true);
    expect(matches(gte, at.getTime() - 1)).toBe(false);
    expect(matches(gte, { epochMilliseconds: at.getTime() + 1 })).toBe(true);
  });

  test("an unparsable date is UNKNOWN", () => {
    expect(matches(gte, "not a date")).toBe(false);
    expect(matches({ type: "not", node: gte }, "not a date")).toBe(false);
  });

  test("eq/inArray compare instants by time", () => {
    expect(matches(cond({ field: "x", op: "eq", value: at }), new Date(at.getTime()))).toBe(true);
    expect(matches(cond({ field: "x", op: "inArray", values: [at] }), at.toISOString())).toBe(true);
  });
});

describe("array ops", () => {
  const op = (o: string, values: unknown[]) => cond({ field: "x", op: o, values });

  test("postgres @> / <@ / &&", () => {
    expect(matches(op("arrayContains", ["a", "b"]), ["b", "a", "c"])).toBe(true);
    expect(matches(op("arrayContains", ["a", "d"]), ["a", "b"])).toBe(false);
    expect(matches(op("arrayContains", []), [])).toBe(true);
    expect(matches(op("arrayContained", ["a", "b"]), ["a"])).toBe(true);
    expect(matches(op("arrayContained", ["a", "b"]), [])).toBe(true);
    expect(matches(op("arrayContained", ["a"]), ["a", "c"])).toBe(false);
    expect(matches(op("arrayOverlaps", ["a", "z"]), ["z"])).toBe(true);
    expect(matches(op("arrayOverlaps", ["a"]), [])).toBe(false);
    expect(matches(op("arrayContains", [1]), ["1"])).toBe(false); // typed, no coercion
  });

  test("postgres: a NULL array is UNKNOWN for every op, even under NOT", () => {
    for (const o of ["arrayContains", "arrayContained", "arrayOverlaps"]) {
      expect(matches(op(o, ["a"]), null)).toBe(false);
      expect(matches({ type: "not", node: op(o, ["a"]) }, null)).toBe(false);
    }
  });

  test("sqlite: a NULL array is an empty list (json_each yields no rows)", () => {
    expect(matches(op("arrayContained", ["a"]), null, "sqlite")).toBe(true);
    expect(matches(op("arrayContains", ["a"]), null, "sqlite")).toBe(false);
    expect(matches({ type: "not", node: op("arrayOverlaps", ["a"]) }, null, "sqlite")).toBe(true);
  });
});

describe("filter plumbing", () => {
  test("no surviving filter matches every row", () => {
    const { predicate } = buildFilterPredicate({
      spec: { name: textField({ path: "name" }) },
      filters: [{ field: "secret", filter: { kind: "text", operator: "eq", value: "x" } }],
    });
    expect(predicate({ name: "a" })).toBe(true);
    expect(toFilterPredicate({ where: null, paths: {} })({})).toBe(true);
  });

  test("conditions on fields missing from paths are dropped", () => {
    const predicate = toFilterPredicate({
      where: {
        type: "and",
        nodes: [
          cond({ field: "x", op: "eq", value: 1 }),
          cond({ field: "unknown", op: "eq", value: 2 }),
        ],
      },
      paths: { x: "x" },
    });
    expect(predicate({ x: 1 })).toBe(true);
  });

  test("a date preset without resolveDate throws (like every adapter)", () => {
    expect(() =>
      buildFilterPredicate({
        spec: { at: dateField({ path: "at" }) },
        filters: [
          {
            field: "at",
            filter: {
              kind: "date",
              operator: "is",
              unit: "day",
              timeZone: "UTC",
              anchor: "2026-01-01T00:00:00",
            },
          },
        ],
      }),
    ).toThrow(/resolveDate/);
  });
});

describe("buildComparator", () => {
  const rows = [
    { id: 1, n: 2 },
    { id: 2, n: null },
    { id: 3, n: 1 },
  ];
  const ids = (compare: (a: (typeof rows)[number], b: (typeof rows)[number]) => number) =>
    [...rows].sort(compare).map((r) => r.id);
  const by = (
    dir: "asc" | "desc",
    options: { dialect?: MemoryDialect; nulls?: "first" | "last" },
  ) => buildComparator({ sort: [{ field: "n", dir }], paths: { n: "n" }, ...options }).compare;

  test("NULL placement per dialect", () => {
    expect(ids(by("asc", {}))).toEqual([3, 1, 2]); // postgres: NULLS LAST ascending
    expect(ids(by("desc", {}))).toEqual([2, 1, 3]); // postgres: NULLS FIRST descending
    expect(ids(by("asc", { dialect: "sqlite" }))).toEqual([2, 3, 1]);
    expect(ids(by("desc", { dialect: "sqlite" }))).toEqual([1, 3, 2]);
  });

  test("nulls pins NULLs first/last whatever the direction", () => {
    expect(ids(by("asc", { nulls: "first" }))).toEqual([2, 3, 1]);
    expect(ids(by("desc", { nulls: "first" }))).toEqual([2, 1, 3]);
    expect(ids(by("asc", { nulls: "last" }))).toEqual([3, 1, 2]);
    expect(ids(by("desc", { nulls: "last", dialect: "sqlite" }))).toEqual([1, 3, 2]);
  });

  test("strings by code point, not locale; dates by time", () => {
    const words = ["b", "B", "a", "\u{1F600}", "Ａ"].map((w) => ({ w }));
    const { compare } = buildComparator({ sort: [{ field: "w", dir: "asc" }], paths: { w: "w" } });
    expect([...words].sort(compare).map((r) => r.w)).toEqual(["B", "a", "b", "Ａ", "\u{1F600}"]);

    const dates = [new Date(2), "1970-01-01T00:00:00.001Z", new Date(3)].map((d) => ({ d }));
    const byDate = buildComparator({ sort: [{ field: "d", dir: "desc" }], paths: { d: "d" } });
    expect([...dates].sort(byDate.compare).map((r) => r.d)).toEqual([
      new Date(3),
      new Date(2),
      "1970-01-01T00:00:00.001Z",
    ]);
  });

  test("stable: ties keep input order; no keys keep everything in place", () => {
    const tied = [
      { id: 1, g: "x" },
      { id: 2, g: "y" },
      { id: 3, g: "x" },
    ];
    const { compare } = buildComparator({ sort: [{ field: "g", dir: "asc" }], paths: { g: "g" } });
    expect([...tied].sort(compare).map((r) => r.id)).toEqual([1, 3, 2]);
    const none = buildComparator({ sort: [{ field: "nope", dir: "asc" }], paths: { g: "g" } });
    expect([...tied].sort(none.compare).map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe("createMemoryPaginator", () => {
  const rows = [
    { id: 1, at: 30 },
    { id: 2, at: null },
    { id: 3, at: 10 },
    { id: 4, at: 20 },
    { id: 5, at: null },
    { id: 6, at: 10 },
  ];
  const sort = [{ key: "at", order: "asc" as const }, { key: "id" }];
  const walk = (dialect?: MemoryDialect) => {
    const paginator = createMemoryPaginator({ rows, sort, dialect });
    const seen: number[] = [];
    let cursor: string | null | undefined;
    for (;;) {
      const page = paginator.paginate({ type: "cursor", limit: 2, cursor });
      seen.push(...page.items.map((r) => r.id));
      if (!page.pageInfo.hasNextPage) return seen;
      cursor = page.pageInfo.endCursor;
    }
  };

  test("cursor pages walk every row once, NULL sort keys included", () => {
    expect(walk()).toEqual([3, 6, 4, 1, 2, 5]); // postgres: NULLs last ascending
    expect(walk("sqlite")).toEqual([2, 5, 3, 6, 4, 1]);
  });

  test("backward pages come back in natural order", () => {
    const paginator = createMemoryPaginator({ rows, sort });
    const all = paginator.paginate({ type: "offset", limit: 10, offset: 0 }).items;
    const anchor = paginator.cursorFor(all[4]!); // id 2
    const before = paginator.paginate({
      type: "cursor",
      limit: 2,
      cursor: anchor,
      direction: "backward",
    });
    expect(before.items.map((r) => r.id)).toEqual([4, 1]);
    expect(before.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: true });
    const last = paginator.paginate({ type: "cursor", limit: 2, direction: "backward" });
    expect(last.items.map((r) => r.id)).toEqual([2, 5]);
  });

  test("offset pages are synchronous slices with totals; maxLimit caps", () => {
    const paginator = createMemoryPaginator({ rows, sort, maxLimit: 3 });
    const page = paginator.paginate({ type: "page", page: 1, pageSize: 50 });
    expect(page.items.map((r) => r.id)).toEqual([3, 6, 4]);
    expect(page.pageInfo).toMatchObject({ hasNextPage: true, totalItems: 6, totalPages: 2 });
  });

  test("Date sort keys survive the JSON cursor round trip", () => {
    const dated = [3, 1, 2].map((d) => ({ id: d, at: new Date(Date.UTC(2026, 0, d)) }));
    const paginator = createMemoryPaginator({
      rows: dated,
      sort: [{ key: "at", order: "desc" }, { key: "id" }],
    });
    const first = paginator.paginate({ type: "cursor", limit: 1 });
    const second = paginator.paginate({
      type: "cursor",
      limit: 5,
      cursor: first.pageInfo.endCursor,
    });
    expect([...first.items, ...second.items].map((r) => r.id)).toEqual([3, 2, 1]);
  });

  test("keys read paths (getters too)", () => {
    const nested = [{ m: { v: 2 } }, { m: { v: 1 } }];
    const paginator = createMemoryPaginator({
      rows: nested,
      sort: [{ key: "v" }],
      paths: { v: (r: { m: { v: number } }) => r.m.v },
    });
    expect(paginator.paginate({ type: "offset", limit: 5, offset: 0 }).items).toEqual([
      { m: { v: 1 } },
      { m: { v: 2 } },
    ]);
  });
});
