// Shared fixtures for the PostgREST and Elasticsearch adapter agreement tests: the same filter
// trees are evaluated by the memory adapter (SQL semantics, the ground truth) and by each
// adapter's output, interpreted by a small model of the target engine.
import type { FieldFilter, FilterNode } from "../src/filters/types.ts";

export type Row = {
  id: number;
  name: string | null;
  amount: number | null;
  status: string | null;
  done: boolean | null;
  tags: string[] | null;
  createdAt: Date | null;
  order: string | null;
};

export const rows: Row[] = [
  {
    id: 1,
    name: "Rent, May",
    amount: 100,
    status: "open",
    done: true,
    tags: ["ts", "js"],
    createdAt: new Date("2026-01-05T00:00:00Z"),
    order: "a",
  },
  {
    id: 2,
    name: "50% off",
    amount: -5,
    status: "on hold, maybe",
    done: false,
    tags: ["ts"],
    createdAt: new Date("2026-02-05T00:00:00Z"),
    order: "b",
  },
  {
    id: 3,
    name: "a*b",
    amount: null,
    status: null,
    done: null,
    tags: null,
    createdAt: null,
    order: null,
  },
  {
    id: 4,
    name: 'Quote:"x" \\back',
    amount: 20,
    status: "done",
    done: true,
    tags: ["a,b", "}{"],
    createdAt: new Date("2026-01-20T00:00:00Z"),
    order: "a",
  },
  {
    id: 5,
    name: "Ann_1",
    amount: 7,
    status: "open",
    done: false,
    tags: ["go"],
    createdAt: new Date("2026-01-10T00:00:00Z"),
    order: "c",
  },
  {
    id: 6,
    name: null,
    amount: 3,
    status: "open",
    done: true,
    tags: ["js", "rs"],
    createdAt: new Date("2026-03-01T00:00:00Z"),
    order: "b",
  },
  {
    id: 7,
    name: "ANNA (x.y)",
    amount: 50,
    status: "done",
    done: false,
    tags: ["rs"],
    createdAt: new Date("2026-01-31T23:59:59Z"),
    order: "c",
  },
  {
    id: 8,
    name: "50 percent",
    amount: 10,
    status: "open",
    done: null,
    tags: ["ts", "rs", "js"],
    createdAt: new Date("2025-12-31T00:00:00Z"),
    order: "a",
  },
  {
    id: 9,
    name: "",
    amount: 0,
    status: "",
    done: false,
    tags: [""],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    order: "d",
  },
];

export const resolveDate = () => ({
  start: new Date("2026-01-01T00:00:00Z"),
  end: new Date("2026-02-01T00:00:00Z"),
});

const col = (field: string, filter: FieldFilter): FilterNode => ({ type: "column", field, filter });
const text = (operator: string, value: string): FilterNode =>
  col("name", { kind: "text", operator, value } as FieldFilter);
const num = (operator: "lt" | "gt" | "gte" | "eq" | "ne", value: number): FilterNode =>
  col("amount", { kind: "number", operator, value });
const status = (value: string): FilterNode =>
  col("status", { kind: "enum", operator: "eq", value });
const tags = (operator: "arrayContains" | "arrayOverlaps", values: string[]): FilterNode =>
  col("tags", { kind: "array", operator, values });
const not = (node: FilterNode): FilterNode => ({ type: "not", node });
const or = (...nodes: FilterNode[]): FilterNode => ({ type: "or", nodes });
const and = (...nodes: FilterNode[]): FilterNode => ({ type: "and", nodes });

/** Cases every adapter under test supports (no `arrayContained`). */
export const cases: [string, FilterNode][] = [
  ["eq with comma", text("eq", "Rent, May")],
  ["eq with quote + backslash", text("eq", 'Quote:"x" \\back')],
  ["eq empty string", text("eq", "")],
  ["ne", text("ne", "a*b")],
  ["contains %", text("contains", "50%")],
  ["contains _", text("contains", "n_")],
  ["contains *", text("contains", "*")],
  ["contains, case-insensitive", text("contains", "ann")],
  ["contains parens + dot", text("contains", "(x.y)")],
  ["contains backslash", text("contains", "\\b")],
  ["startsWith", text("startsWith", "50")],
  ["startsWith *", text("startsWith", "a*")],
  ["endsWith", text("endsWith", "OFF")],
  ["like", text("like", "A%")],
  ["like escaped %", text("like", "50\\%%")],
  ["like _", text("like", "Ann__")],
  ["like literal *", text("like", "a*%")],
  ["ilike", text("ilike", "%nn%")],
  ["notIlike", text("notIlike", "%nn%")],
  ["notIlike literal *", text("notIlike", "%*%")],
  [
    "text inArray, reserved chars",
    col("name", {
      kind: "text",
      operator: "inArray",
      values: ["Rent, May", 'Quote:"x" \\back', "a*b", "(", "ANNA (x.y)"],
    }),
  ],
  [
    "text notInArray",
    col("name", { kind: "text", operator: "notInArray", values: ["Rent, May", "a*b"] }),
  ],
  ['text inArray [""]', col("name", { kind: "text", operator: "inArray", values: [""] })],
  ['text notInArray [""]', col("name", { kind: "text", operator: "notInArray", values: [""] })],
  ["isNull", col("name", { kind: "text", operator: "isNull" })],
  ["isNotNull", col("name", { kind: "text", operator: "isNotNull" })],
  ["between", col("amount", { kind: "number", operator: "between", from: 0, to: 20 })],
  ["notBetween", col("amount", { kind: "number", operator: "notBetween", from: 0, to: 20 })],
  ["number inArray", col("amount", { kind: "number", operator: "inArray", values: [7, 10, 3] })],
  ["number ne", num("ne", 10)],
  [
    "enum inArray",
    col("status", { kind: "enum", operator: "inArray", values: ["on hold, maybe", "done"] }),
  ],
  ["enum notInArray", col("status", { kind: "enum", operator: "notInArray", values: ["open"] })],
  ["boolean eq", col("done", { kind: "boolean", operator: "eq", value: true })],
  ["boolean ne", col("done", { kind: "boolean", operator: "ne", value: true })],
  ["boolean isNull", col("done", { kind: "boolean", operator: "isNull" })],
  ["arrayContains", tags("arrayContains", ["ts", "js"])],
  ["arrayContains reserved chars", tags("arrayContains", ["a,b", "}{"])],
  ["arrayOverlaps", tags("arrayOverlaps", ["rs", "a,b"])],
  ["arrayOverlaps empty string", tags("arrayOverlaps", [""])],
  [
    "date preset",
    col("createdAt", {
      kind: "date",
      operator: "is",
      unit: "month",
      timeZone: "UTC",
      anchor: "2026-01-15T00:00:00",
    }),
  ],
  ["column named order", col("order", { kind: "enum", operator: "eq", value: "a" })],
  ["or", or(num("lt", 0), text("eq", "Rent, May"))],
  [
    "or with quoting",
    or(text("eq", 'Quote:"x" \\back'), text("contains", "(x.y)"), text("eq", "")),
  ],
  ["or of array ops", or(tags("arrayContains", ["}{"]), tags("arrayOverlaps", ["go"]))],
  [
    "or with inArray",
    or(
      col("status", { kind: "enum", operator: "inArray", values: ["on hold, maybe"] }),
      num("gt", 50),
    ),
  ],
  ["or with literal *", or(text("contains", "*"), text("ilike", "rent%"))],
  [
    "or with dates",
    or(
      col("createdAt", {
        kind: "date",
        operator: "is",
        unit: "month",
        timeZone: "UTC",
        anchor: "2026-01-15T00:00:00",
      }),
      col("done", { kind: "boolean", operator: "isNull" }),
    ),
  ],
  ["not (NULL stays out)", not(num("lt", 10))],
  ["not ne", not(text("ne", "a*b"))],
  [
    "not notInArray",
    not(col("status", { kind: "enum", operator: "notInArray", values: ["open"] })),
  ],
  ["not isNotNull", not(col("done", { kind: "boolean", operator: "isNotNull" }))],
  ["not or", not(or(num("lt", 10), status("done")))],
  [
    "not and",
    not(and(num("gte", 10), col("done", { kind: "boolean", operator: "eq", value: true }))),
  ],
  ["not not", not(not(num("lt", 10)))],
  [
    "and of ors",
    and(
      or(num("lt", 10), status("done")),
      or(
        col("done", { kind: "boolean", operator: "eq", value: false }),
        col("order", { kind: "enum", operator: "eq", value: "a" }),
      ),
    ),
  ],
  [
    "deep nesting",
    or(
      and(num("gte", 10), not(text("ilike", "%rent%"))),
      not(or(status("open"), tags("arrayOverlaps", ["rs"]))),
    ),
  ],
  ["not on the order column", not(col("order", { kind: "enum", operator: "eq", value: "a" }))],
];
