import { describe, expect, test } from "vitest";
import {
  arrayField,
  booleanField,
  buildFilterNode,
  buildQuery,
  buildSort,
  createElasticsearchKeyset,
  dateField,
  type ElasticsearchQuery,
  enumField,
  numberField,
  textField,
  toElasticsearchQuery,
} from "../src/filters/elasticsearch.ts";
import * as memory from "../src/filters/memory.ts";
import type { ColumnFilter, FieldFilter } from "../src/filters/types.ts";
import { cases, resolveDate, rows, type Row } from "./filters-search-cases.ts";

const spec = {
  name: textField({ field: "name.keyword" }),
  amount: numberField({ field: "amount" }),
  status: enumField({ field: "status" }),
  done: booleanField({ field: "done" }),
  tags: arrayField({ field: "tags" }),
  createdAt: dateField({ field: "createdAt" }),
  order: enumField({ field: "order" }),
};

const one = (filter: FieldFilter, field = "name") =>
  buildQuery({ spec, filters: [{ field, filter } as ColumnFilter], resolveDate }).query;

describe("elasticsearch adapter: rendering", () => {
  test("scalar ops → term / range", () => {
    expect(one({ kind: "number", operator: "eq", value: 3 }, "amount")).toEqual({
      term: { amount: 3 },
    });
    expect(one({ kind: "number", operator: "lte", value: 3 }, "amount")).toEqual({
      range: { amount: { lte: 3 } },
    });
    expect(one({ kind: "number", operator: "between", from: 1, to: 2 }, "amount")).toEqual({
      bool: { filter: [{ range: { amount: { gte: 1 } } }, { range: { amount: { lte: 2 } } }] },
    });
  });

  test("ne / notInArray / notIlike keep NULLs out with an exists guard", () => {
    expect(one({ kind: "text", operator: "ne", value: "x" })).toEqual({
      bool: {
        filter: [{ exists: { field: "name.keyword" } }],
        must_not: [{ term: { "name.keyword": "x" } }],
      },
    });
    expect(one({ kind: "enum", operator: "notInArray", values: ["a"] }, "status")).toEqual({
      bool: { filter: [{ exists: { field: "status" } }], must_not: [{ terms: { status: ["a"] } }] },
    });
    expect(one({ kind: "text", operator: "notIlike", value: "a%" })).toEqual({
      bool: {
        filter: [{ exists: { field: "name.keyword" } }],
        must_not: [{ wildcard: { "name.keyword": { value: "a*", case_insensitive: true } } }],
      },
    });
  });

  test("text ops → wildcard / prefix, input escaped", () => {
    expect(one({ kind: "text", operator: "contains", value: "a*?\\" })).toEqual({
      wildcard: { "name.keyword": { value: "*a\\*\\?\\\\*", case_insensitive: true } },
    });
    expect(one({ kind: "text", operator: "endsWith", value: "z" })).toEqual({
      wildcard: { "name.keyword": { value: "*z", case_insensitive: true } },
    });
    expect(one({ kind: "text", operator: "startsWith", value: "a*" })).toEqual({
      prefix: { "name.keyword": { value: "a*", case_insensitive: true } },
    });
    expect(one({ kind: "text", operator: "like", value: "a%_\\%*" })).toEqual({
      wildcard: { "name.keyword": { value: "a*?%\\*" } },
    });
    expect(one({ kind: "text", operator: "ilike", value: "%a" })).toEqual({
      wildcard: { "name.keyword": { value: "*a", case_insensitive: true } },
    });
  });

  test("null checks → exists", () => {
    expect(one({ kind: "text", operator: "isNotNull" })).toEqual({
      exists: { field: "name.keyword" },
    });
    expect(one({ kind: "text", operator: "isNull" })).toEqual({
      bool: { must_not: [{ exists: { field: "name.keyword" } }] },
    });
  });

  test("lists and array ops, including empty lists", () => {
    expect(one({ kind: "enum", operator: "inArray", values: [] }, "status")).toEqual({
      match_none: {},
    });
    expect(one({ kind: "enum", operator: "notInArray", values: [] }, "status")).toEqual({
      bool: { filter: [{ exists: { field: "status" } }], must_not: [{ match_none: {} }] },
    });
    expect(one({ kind: "array", operator: "arrayContains", values: ["a"] }, "tags")).toEqual({
      term: { tags: "a" },
    });
    expect(one({ kind: "array", operator: "arrayContains", values: [] }, "tags")).toEqual({
      exists: { field: "tags" },
    });
    expect(one({ kind: "array", operator: "arrayOverlaps", values: [] }, "tags")).toEqual({
      match_none: {},
    });
    expect(() => one({ kind: "array", operator: "arrayContained", values: ["a"] }, "tags")).toThrow(
      /arrayContained/,
    );
  });

  test("dates → ISO strings in range", () => {
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
    ).toEqual({
      bool: {
        filter: [
          { range: { createdAt: { gte: "2026-01-01T00:00:00.000Z" } } },
          { range: { createdAt: { lt: "2026-02-01T00:00:00.000Z" } } },
        ],
      },
    });
  });

  test("not of a group pushes the negation down (De Morgan, SQL NULL semantics)", () => {
    const { query } = buildFilterNode({
      spec,
      node: {
        type: "not",
        node: {
          type: "and",
          nodes: [
            {
              type: "column",
              field: "amount",
              filter: { kind: "number", operator: "gt", value: 1 },
            },
            { type: "column", field: "done", filter: { kind: "boolean", operator: "isNull" } },
          ],
        },
      },
    });
    expect(query).toEqual({
      bool: {
        should: [
          {
            bool: {
              filter: [{ exists: { field: "amount" } }],
              must_not: [{ range: { amount: { gt: 1 } } }],
            },
          },
          { exists: { field: "done" } },
        ],
        minimum_should_match: 1,
      },
    });
  });

  test("non-allow-listed fields drop; nothing left → undefined", () => {
    expect(buildQuery({ spec, filters: [] }).query).toBeUndefined();
    expect(
      buildQuery({
        spec,
        filters: [{ field: "secret", filter: { kind: "text", operator: "eq", value: "x" } }],
      }).query,
    ).toBeUndefined();
    expect(toElasticsearchQuery({ where: null, fields: {} })).toBeUndefined();
  });
});

// ── A model of the Query DSL clauses the adapter emits, over JSON documents ──

const fieldToKey: Record<string, keyof Row> = Object.fromEntries(
  Object.entries(spec).map(([f, s]) => [s.field, f as keyof Row]),
);

// Indexed values: null / [] / missing → none (what `exists` sees); arrays are multi-valued.
function indexed(doc: Row, field: string): unknown[] {
  const v = doc[fieldToKey[field] as keyof Row];
  if (v === null || v === undefined) return [];
  const list = Array.isArray(v) ? v : [v];
  return list.map((x) => (x instanceof Date ? x.getTime() : x));
}

const asComparable = (field: string, q: unknown): unknown =>
  field === "createdAt" && typeof q === "string" ? Date.parse(q) : q;

const fold = (ci: boolean | undefined) => (s: unknown) =>
  ci ? String(s).toLowerCase() : String(s);

function wildcardRegex(pattern: string, ci: boolean | undefined): RegExp {
  let src = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i] ?? "";
    if (c === "\\") {
      src += (pattern[i + 1] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i += 1;
    } else if (c === "*") src += ".*";
    else if (c === "?") src += ".";
    else src += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${src}$`, ci ? "is" : "s");
}

const entry = (clause: Record<string, unknown>) => Object.entries(clause)[0] as [string, any];

function matches(q: ElasticsearchQuery, doc: Row): boolean {
  const [type, body] = entry(q);
  switch (type) {
    case "match_none":
      return false;
    case "exists":
      return indexed(doc, body.field).length > 0;
    case "term": {
      const [field, spec] = entry(body);
      const { value, case_insensitive } =
        typeof spec === "object" && spec !== null ? spec : { value: spec, case_insensitive: false };
      const f = fold(case_insensitive);
      return indexed(doc, field).some((v) => f(v) === f(asComparable(field, value)));
    }
    case "terms": {
      const [field, values] = entry(body);
      return indexed(doc, field).some((v) =>
        (values as unknown[]).some((x) => asComparable(field, x) === v),
      );
    }
    case "range": {
      const [field, bounds] = entry(body);
      return indexed(doc, field).some((v: any) =>
        Object.entries(bounds as Record<string, unknown>).every(([op, raw]) => {
          const b = asComparable(field, raw) as any;
          return op === "gt" ? v > b : op === "gte" ? v >= b : op === "lt" ? v < b : v <= b;
        }),
      );
    }
    case "prefix": {
      const [field, { value, case_insensitive }] = entry(body);
      const f = fold(case_insensitive);
      return indexed(doc, field).some((v) => f(v).startsWith(f(value)));
    }
    case "wildcard": {
      const [field, { value, case_insensitive }] = entry(body);
      const re = wildcardRegex(value, case_insensitive);
      return indexed(doc, field).some((v) => re.test(String(v)));
    }
    case "bool": {
      const { filter = [], must_not = [], should = [], minimum_should_match } = body;
      const shouldHits = (should as ElasticsearchQuery[]).filter((s) => matches(s, doc)).length;
      const min = minimum_should_match ?? (should.length > 0 && filter.length === 0 ? 1 : 0);
      return (
        (filter as ElasticsearchQuery[]).every((f) => matches(f, doc)) &&
        !(must_not as ElasticsearchQuery[]).some((m) => matches(m, doc)) &&
        shouldHits >= min
      );
    }
    default:
      throw new Error(`unmodelled clause ${type}`);
  }
}

const memorySpec = Object.fromEntries(
  Object.entries(spec).map(([f, s]) => [f, { kind: s.kind, path: f }]),
);

describe("elasticsearch adapter: agrees with SQL semantics (Query DSL model)", () => {
  test.each(cases)("%s", (_name, node) => {
    const { predicate } = memory.buildFilterNodePredicate<Row>({
      spec: memorySpec,
      node,
      resolveDate,
    });
    const expected = rows.filter(predicate).map((r) => r.id);

    const { query } = buildFilterNode({ spec, node, resolveDate });
    const got = rows.filter((doc) => (query ? matches(query, doc) : true)).map((r) => r.id);

    expect(got).toEqual(expected);
  });
});

describe("elasticsearch adapter: sort + search_after keyset", () => {
  test("buildSort: allow-list, defaultSort, nulls → missing", () => {
    expect(buildSort({ sort: [{ field: "x", dir: "asc" }], fields: { a: "a" } }).sort).toEqual([]);
    expect(
      buildSort({
        sort: [],
        fields: { a: "a.keyword" },
        defaultSort: [{ field: "a", dir: "desc" }],
        nulls: "first",
      }).sort,
    ).toEqual([{ "a.keyword": { order: "desc", missing: "_first" } }]);
  });

  test("keyset: sort per direction, search_after in sort order, Dates as epoch ms", () => {
    const keyset = createElasticsearchKeyset({
      sort: [{ key: "createdAt", order: "desc" }, { key: "id" }],
      fields: { createdAt: "createdAt", id: "id" },
    });
    expect(keyset.keys()).toEqual(["createdAt", "id"]);
    expect(keyset.sort()).toEqual([{ createdAt: { order: "desc" } }, { id: { order: "asc" } }]);
    expect(keyset.sort("backward")).toEqual([
      { createdAt: { order: "asc" } },
      { id: { order: "desc" } },
    ]);
    expect(keyset.searchAfter(null)).toBeUndefined();
    expect(keyset.searchAfter({ id: "p_9", createdAt: new Date("2026-06-18T00:00:00Z") })).toEqual([
      Date.UTC(2026, 5, 18),
      "p_9",
    ]);
  });
});
