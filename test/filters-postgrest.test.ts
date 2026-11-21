import { PostgrestClient } from "@supabase/postgrest-js";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import type { CompiledCond, FieldKind } from "../src/filters/types.ts";
import * as memory from "../src/filters/memory.ts";
import {
  applyFiltersToPostgrest,
  applyParamsToPostgrest,
  arrayField,
  booleanField,
  buildFilterNode,
  buildOrder,
  buildParams,
  createPostgrestKeyset,
  dateField,
  enumField,
  formatOrder,
  numberField,
  type PostgrestParams,
  textField,
  toPostgrestParams,
} from "../src/filters/postgrest.ts";
import { cases, resolveDate, rows, type Row } from "./filters-search-cases.ts";
import { server } from "./setup-msw.ts";

const spec = {
  name: textField({ column: "name" }),
  amount: numberField({ column: "amount" }),
  status: enumField({ column: "status" }),
  done: booleanField({ column: "done" }),
  tags: arrayField({ column: "tags" }),
  createdAt: dateField({ column: "created_at" }),
  order: enumField({ column: "order" }),
};

const one = (
  filter: Parameters<typeof buildParams>[0]["filters"][number]["filter"],
  field = "name",
) => buildParams({ spec, filters: [{ field, filter }], resolveDate }).params;

describe("postgrest adapter: rendering", () => {
  test("scalar ops", () => {
    expect(one({ kind: "number", operator: "eq", value: 3 }, "amount")).toEqual([
      ["amount", "eq.3"],
    ]);
    expect(one({ kind: "number", operator: "ne", value: 3 }, "amount")).toEqual([
      ["amount", "neq.3"],
    ]);
    expect(one({ kind: "number", operator: "lte", value: 3 }, "amount")).toEqual([
      ["amount", "lte.3"],
    ]);
    expect(one({ kind: "boolean", operator: "eq", value: true }, "done")).toEqual([
      ["done", "eq.true"],
    ]);
  });

  test("top-level values are raw (never quoted)", () => {
    expect(one({ kind: "text", operator: "eq", value: 'a,b."c"' })).toEqual([
      ["name", 'eq.a,b."c"'],
    ]);
  });

  test("text affordances → ilike with * wildcards, escaped %/_/\\", () => {
    expect(one({ kind: "text", operator: "contains", value: "50%_\\" })).toEqual([
      ["name", "ilike.*50\\%\\_\\\\*"],
    ]);
    expect(one({ kind: "text", operator: "startsWith", value: "ab" })).toEqual([
      ["name", "ilike.ab*"],
    ]);
    expect(one({ kind: "text", operator: "endsWith", value: "ab" })).toEqual([
      ["name", "ilike.*ab"],
    ]);
  });

  test("a literal * falls back to an escaped, anchored POSIX regex", () => {
    expect(one({ kind: "text", operator: "contains", value: "a*(b)" })).toEqual([
      ["name", "imatch.a\\*\\(b\\)"],
    ]);
    expect(one({ kind: "text", operator: "endsWith", value: "*" })).toEqual([
      ["name", "imatch.\\*$"],
    ]);
    expect(one({ kind: "text", operator: "like", value: "a*%_" })).toEqual([
      ["name", "match.^a\\*.*.$"],
    ]);
    expect(one({ kind: "text", operator: "notIlike", value: "%*" })).toEqual([
      ["name", "not.imatch.^.*\\*$"],
    ]);
  });

  test("like/ilike/notIlike: unescaped % → *, escapes kept", () => {
    expect(one({ kind: "text", operator: "like", value: "a%b_\\%" })).toEqual([
      ["name", "like.a*b_\\%"],
    ]);
    expect(one({ kind: "text", operator: "ilike", value: "%a" })).toEqual([["name", "ilike.*a"]]);
    expect(one({ kind: "text", operator: "notIlike", value: "%a" })).toEqual([
      ["name", "not.ilike.*a"],
    ]);
  });

  test("lists, null checks, array literals", () => {
    expect(one({ kind: "text", operator: "inArray", values: ["a", "b,c", 'q"\\', ""] })).toEqual([
      ["name", 'in.(a,"b,c","q\\"\\\\","")'],
    ]);
    expect(one({ kind: "enum", operator: "notInArray", values: ["x"] }, "status")).toEqual([
      ["status", "not.in.(x)"],
    ]);
    expect(one({ kind: "number", operator: "inArray", values: [] }, "amount")).toEqual([
      ["amount", "in.()"],
    ]);
    expect(one({ kind: "text", operator: "isNull" })).toEqual([["name", "is.null"]]);
    expect(one({ kind: "text", operator: "isNotNull" })).toEqual([["name", "not.is.null"]]);
    expect(
      one({ kind: "array", operator: "arrayContained", values: ["a", 'b"', 1] }, "tags"),
    ).toEqual([["tags", 'cd.{"a","b\\"",1}']]);
    expect(one({ kind: "array", operator: "arrayOverlaps", values: [] }, "tags")).toEqual([
      ["tags", "ov.{}"],
    ]);
  });

  test("dates → ISO instants", () => {
    expect(
      one(
        {
          kind: "date",
          operator: "is",
          unit: "month",
          timeZone: "UTC",
          anchor: "2026-01-15T00:00:00",
        },
        "createdAt",
      ),
    ).toEqual([
      ["created_at", "gte.2026-01-01T00:00:00.000Z"],
      ["created_at", "lt.2026-02-01T00:00:00.000Z"],
    ]);
  });

  test("groups: or, negated groups, double negation, reserved column names", () => {
    const where = (node: Parameters<typeof buildFilterNode>[0]["node"]) =>
      buildFilterNode({ spec, node }).params;
    const lt = {
      type: "column",
      field: "amount",
      filter: { kind: "number", operator: "lt", value: 1.5 },
    } as const;
    const isA = {
      type: "column",
      field: "order",
      filter: { kind: "enum", operator: "eq", value: "a" },
    } as const;

    expect(where({ type: "or", nodes: [lt, isA] })).toEqual([
      ["or", '(amount.lt."1.5",order.eq.a)'],
    ]);
    expect(where({ type: "not", node: { type: "or", nodes: [lt, isA] } })).toEqual([
      ["not.or", '(amount.lt."1.5",order.eq.a)'],
    ]);
    expect(where({ type: "not", node: { type: "and", nodes: [lt, isA] } })).toEqual([
      ["not.and", '(amount.lt."1.5",order.eq.a)'],
    ]);
    expect(where({ type: "not", node: { type: "not", node: lt } })).toEqual([["amount", "lt.1.5"]]);
    expect(where({ type: "not", node: lt })).toEqual([["amount", "not.lt.1.5"]]);
    // `order` is a reserved query key → wrapped in and=(…)
    expect(where(isA)).toEqual([["and", "(order.eq.a)"]]);
    expect(where({ type: "and", nodes: [lt, isA] })).toEqual([
      ["amount", "lt.1.5"],
      ["and", "(order.eq.a)"],
    ]);
    // a negated, negative leaf cancels instead of emitting not.not.
    expect(
      where({
        type: "not",
        node: { type: "column", field: "name", filter: { kind: "text", operator: "isNotNull" } },
      }),
    ).toEqual([["name", "is.null"]]);
  });

  test("array literals with braces are quoted inside a logic tree", () => {
    const { params } = buildFilterNode({
      spec,
      node: {
        type: "or",
        nodes: [
          {
            type: "column",
            field: "tags",
            filter: { kind: "array", operator: "arrayContains", values: ["a,b"] },
          },
          {
            type: "column",
            field: "tags",
            filter: { kind: "array", operator: "arrayContains", values: ["}{"] },
          },
        ],
      },
    });
    expect(params).toEqual([["or", '(tags.cs.{"a,b"},tags.cs."{\\"}{\\"}")']]);
  });

  test("non-allow-listed fields drop; nothing left → []", () => {
    expect(buildParams({ spec, filters: [] }).params).toEqual([]);
    expect(
      buildParams({
        spec,
        filters: [{ field: "secret", filter: { kind: "text", operator: "eq", value: "x" } }],
      }).params,
    ).toEqual([]);
    expect(toPostgrestParams({ where: null, columns: {} })).toEqual([]);
  });

  test("invalid columns throw; JSON paths are allowed", () => {
    expect(() =>
      buildParams({
        spec: { x: textField({ column: "a,b" }) },
        filters: [{ field: "x", filter: { kind: "text", operator: "eq", value: "1" } }],
      }),
    ).toThrow(/invalid column "a,b"/);
    expect(
      buildParams({
        spec: { city: textField({ column: "meta->>city" }) },
        filters: [{ field: "city", filter: { kind: "text", operator: "eq", value: "Lima" } }],
      }).params,
    ).toEqual([["meta->>city", "eq.Lima"]]);
  });
});

// ── A port of the PostgREST filter grammar (ApiRequest/QueryParams.hs) to decode params ──

type Expr =
  | { type: "leaf"; column: string; negated: boolean; op: string; value: string | string[] | null }
  | { type: "group"; negated: boolean; op: "and" | "or"; nodes: Expr[] };

class Parser {
  i = 0;
  constructor(readonly s: string) {}
  peek = () => this.s[this.i];
  eat(str: string) {
    if (!this.s.startsWith(str, this.i))
      throw new Error(`expected ${str} at ${this.i} in ${this.s}`);
    this.i += str.length;
  }
  tryEat(str: string) {
    if (!this.s.startsWith(str, this.i)) return false;
    this.i += str.length;
    return true;
  }
  // pQuotedValue: "…" with \x → x
  quoted(): string {
    this.eat('"');
    let out = "";
    while (this.peek() !== '"') {
      if (this.i >= this.s.length) throw new Error("unterminated quote");
      if (this.peek() === "\\") this.i += 1;
      out += this.s[this.i];
      this.i += 1;
    }
    this.eat('"');
    return out;
  }
  until(stop: string): string {
    const start = this.i;
    while (this.i < this.s.length && !stop.includes(this.s[this.i] ?? "")) this.i += 1;
    return this.s.slice(start, this.i);
  }
  // pListVal / pListElement
  list(): string[] {
    this.eat("(");
    const out: string[] = [];
    do {
      out.push(this.peek() === '"' ? this.quoted() : this.until(",)"));
    } while (this.tryEat(","));
    this.eat(")");
    return out;
  }
  // pLogicSingleVal (or the raw rest of the string at top level)
  single(top: boolean): string {
    if (top) {
      const rest = this.s.slice(this.i);
      this.i = this.s.length;
      return rest;
    }
    if (this.peek() === '"') return this.quoted();
    if (this.peek() === "{") {
      const start = this.i;
      this.until("}");
      this.eat("}");
      return this.s.slice(start, this.i);
    }
    return this.until(",)");
  }
  opExpr(column: string, top: boolean): Expr {
    const negated = this.tryEat("not.");
    if (this.tryEat("in.")) return { type: "leaf", column, negated, op: "in", value: this.list() };
    if (this.tryEat("is.")) {
      this.eat("null");
      return { type: "leaf", column, negated, op: "is", value: null };
    }
    const op = this.until(".");
    this.eat(".");
    return { type: "leaf", column, negated, op, value: this.single(top) };
  }
  // pLogicTree
  tree(): Expr {
    const save = this.i;
    const negated = this.tryEat("not.");
    for (const op of ["and", "or"] as const) {
      if (this.tryEat(`${op}(`)) {
        const nodes: Expr[] = [];
        do nodes.push(this.tree());
        while (this.tryEat(","));
        this.eat(")");
        return { type: "group", negated, op, nodes };
      }
    }
    this.i = save;
    const column = this.until(".");
    this.eat(".");
    return this.opExpr(column, false);
  }
}

const decode = (params: PostgrestParams): Expr[] =>
  params.map(([key, value]) => {
    if (["or", "and", "not.or", "not.and"].includes(key)) {
      const p = new Parser(`${key}${value}`);
      const e = p.tree();
      expect(p.i).toBe(p.s.length);
      return e;
    }
    return new Parser(value).opExpr(key, true);
  });

// Evaluate decoded params as Postgres would (SQL three-valued logic: null = unknown).
const columnToField: Record<string, string> = Object.fromEntries(
  Object.entries(spec).map(([f, s]) => [s.column, f]),
);
const kindOf = (column: string): FieldKind => spec[columnToField[column] as keyof typeof spec].kind;

function coerce(column: string, raw: string): string | number | boolean | Date {
  switch (kindOf(column)) {
    case "number":
      return Number(raw);
    case "boolean":
      return raw === "true";
    case "date":
      return new Date(raw);
    default:
      return raw;
  }
}

// PG array literal → elements (always-quoted strings or bare numbers).
function pgArray(literal: string): (string | number)[] {
  const p = new Parser(literal);
  p.eat("{");
  const out: (string | number)[] = [];
  if (p.peek() !== "}") {
    do out.push(p.peek() === '"' ? p.quoted() : Number(p.until(",}")));
    while (p.tryEat(","));
  }
  p.eat("}");
  return out;
}

function leafCond(e: Extract<Expr, { type: "leaf" }>): CompiledCond | RegExp {
  const field = columnToField[e.column] as string;
  const v = e.value;
  switch (e.op) {
    case "in": {
      // SqlFragment.hs: a list that parses to [""] becomes `= ANY('{}')` (matches nothing).
      const list = v as string[];
      const values = list.length === 1 && list[0] === "" ? [] : list;
      return { field, op: "inArray", values: values.map((x) => coerce(e.column, x)) };
    }
    case "is":
      return { field, op: "isNull" };
    case "neq":
      return { field, op: "ne", value: coerce(e.column, v as string) };
    case "eq":
    case "lt":
    case "gt":
    case "lte":
    case "gte":
      return { field, op: e.op, value: coerce(e.column, v as string) };
    case "like":
    case "ilike":
      return { field, op: e.op, value: (v as string).replaceAll("*", "%") }; // PostgREST: every * → %
    case "match":
    case "imatch":
      return new RegExp(v as string, e.op === "imatch" ? "is" : "s");
    case "cs":
    case "cd":
    case "ov":
      return {
        field,
        op: e.op === "cs" ? "arrayContains" : e.op === "cd" ? "arrayContained" : "arrayOverlaps",
        values: pgArray(v as string),
      };
    default:
      throw new Error(`unknown op ${e.op}`);
  }
}

type Tri = boolean | null;
const notTri = (t: Tri): Tri => (t === null ? null : !t);

function evaluate(e: Expr, row: Row): Tri {
  if (e.type === "group") {
    const vals = e.nodes.map((n) => evaluate(n, row));
    const r: Tri =
      e.op === "and"
        ? vals.includes(false)
          ? false
          : vals.includes(null)
            ? null
            : true
        : vals.includes(true)
          ? true
          : vals.includes(null)
            ? null
            : false;
    return e.negated ? notTri(r) : r;
  }
  const field = columnToField[e.column] as keyof Row;
  const cond = leafCond(e);
  let r: Tri;
  if (e.op === "is") r = row[field] === null;
  else if (row[field] === null) r = null;
  else if (cond instanceof RegExp) r = cond.test(String(row[field]));
  else {
    r = memory.toFilterPredicate<Row>({
      where: { type: "cond", cond },
      paths: { [cond.field]: cond.field },
    })(row);
  }
  return e.negated ? notTri(r) : r;
}

const memorySpec = Object.fromEntries(
  Object.entries(spec).map(([f, s]) => [f, { kind: s.kind, path: f }]),
);

describe("postgrest adapter: agrees with SQL semantics (PostgREST grammar decoded)", () => {
  test.each(cases)("%s", (_name, node) => {
    const { predicate } = memory.buildFilterNodePredicate<Row>({
      spec: memorySpec,
      node,
      resolveDate,
    });
    const expected = rows.filter(predicate).map((r) => r.id);

    const exprs = decode(buildFilterNode({ spec, node, resolveDate }).params);
    const got = rows
      .filter((row) => exprs.every((e) => evaluate(e, row) === true))
      .map((r) => r.id);

    expect(got).toEqual(expected);
  });
});

describe("postgrest adapter: postgrest-js round-trip (fetch intercepted)", () => {
  const URL_BASE = "http://postgrest.test";

  const capture = async (run: (client: PostgrestClient) => PromiseLike<unknown>) => {
    let seen: URL | undefined;
    server.use(
      http.get(`${URL_BASE}/items`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json([]);
      }),
    );
    await run(new PostgrestClient(URL_BASE));
    return seen as URL;
  };

  test.each(cases)("%s: builder sends the same filters as the raw params", async (_name, node) => {
    const { params } = buildFilterNode({ spec, node, resolveDate });
    const url = await capture((c) => applyParamsToPostgrest(c.from("items").select("id"), params));
    const sent = [...url.searchParams].filter(([k]) => k !== "select");

    // Same semantics: `and=(…)`/`not.*=(…)` arrive as a one-element `or=(…)`.
    const viaBuilder = decode(sent).map((e) =>
      rows.filter((r) => evaluate(e, r) === true).map((r) => r.id),
    );
    const viaRaw = decode(params).map((e) =>
      rows.filter((r) => evaluate(e, r) === true).map((r) => r.id),
    );
    expect(viaBuilder).toEqual(viaRaw);
    // Column filters are sent byte-for-byte.
    expect(sent.filter(([k]) => !k.includes("or") && !k.includes("and"))).toEqual(
      params.filter(([k]) => !["or", "and", "not.or", "not.and"].includes(k)),
    );
  });

  test("filters + order + range compose into one request", async () => {
    const { order } = buildOrder({
      sort: [{ field: "createdAt", dir: "desc" }],
      columns: { createdAt: "created_at" },
      nulls: "last",
    });
    const url = await capture((c) => {
      let q = applyFiltersToPostgrest(c.from("items").select("id"), {
        spec,
        filters: [
          { field: "name", filter: { kind: "text", operator: "contains", value: "an" } },
          {
            field: "status",
            filter: { kind: "enum", operator: "inArray", values: ["open", "a,b"] },
          },
        ],
      });
      for (const t of order) q = q.order(t.column, t);
      return q.range(20, 29);
    });
    expect([...url.searchParams]).toEqual([
      ["select", "id"],
      ["name", "ilike.*an*"],
      ["status", 'in.(open,"a,b")'],
      ["order", "created_at.desc.nullslast"],
      ["offset", "20"],
      ["limit", "10"],
    ]);
  });
});

describe("postgrest adapter: order + keyset", () => {
  test("buildOrder: allow-list, defaultSort, nulls", () => {
    expect(
      buildOrder({ sort: [{ field: "nope", dir: "asc" }], columns: { a: "a" } }).order,
    ).toEqual([]);
    expect(
      buildOrder({
        sort: [{ field: "nope", dir: "asc" }],
        columns: { a: "a" },
        defaultSort: [{ field: "a", dir: "desc" }],
      }).order,
    ).toEqual([{ column: "a", ascending: false }]);
    expect(
      formatOrder(
        buildOrder({ sort: [{ field: "a", dir: "asc" }], columns: { a: "a" }, nulls: "first" })
          .order,
      ),
    ).toBe("a.asc.nullsfirst");
  });

  test("keyset: order terms per direction + lexicographic seek params", () => {
    const keyset = createPostgrestKeyset({
      sort: [
        { key: "amount", order: "desc" },
        { key: "id", order: "desc" },
      ],
      columns: { amount: "amount", id: "id" },
    });
    expect(formatOrder(keyset.orderBy())).toBe("amount.desc,id.desc");
    expect(formatOrder(keyset.orderBy("backward"))).toBe("amount.asc,id.asc");
    expect(keyset.keys()).toEqual(["amount", "id"]);
    expect(keyset.where(null)).toEqual([]);
    expect(keyset.where({ amount: 20, id: 4 })).toEqual([
      ["or", "(amount.lt.20,and(amount.eq.20,id.lt.4))"],
    ]);
    expect(keyset.where({ amount: 20, id: 4 }, "backward")).toEqual([
      ["or", "(amount.gt.20,and(amount.eq.20,id.gt.4))"],
    ]);
    // The seek decodes cleanly with PostgREST's grammar.
    expect(decode(keyset.where({ amount: 1.5, id: 4 }))[0]).toEqual({
      type: "group",
      negated: false,
      op: "or",
      nodes: [
        { type: "leaf", column: "amount", negated: false, op: "lt", value: "1.5" },
        {
          type: "group",
          negated: false,
          op: "and",
          nodes: [
            { type: "leaf", column: "amount", negated: false, op: "eq", value: "1.5" },
            { type: "leaf", column: "id", negated: false, op: "lt", value: "4" },
          ],
        },
      ],
    });
  });

  test("keyset with a single key renders a plain column param", () => {
    const keyset = createPostgrestKeyset({ sort: [{ key: "id" }], columns: { id: "id" } });
    expect(keyset.where({ id: 5 })).toEqual([["id", "gt.5"]]);
    expect(keyset.where({ id: 5 }, "backward")).toEqual([["id", "lt.5"]]);
  });
});
