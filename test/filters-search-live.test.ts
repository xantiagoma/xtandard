// Real-engine agreement for the PostgREST and Elasticsearch adapters. Skipped unless
// POSTGREST_URL / ELASTICSEARCH_URL point at live servers (the `search-live` CI job starts
// Postgres + PostgREST and Elasticsearch as service containers). Each shared case must return
// the same ids from the engine as from the memory adapter (SQL semantics).
//
// PostgREST setup this suite expects (the CI job runs it with psql):
//   create role anon nologin;
//   create table items (id int primary key, name text, amount numeric, status text,
//     done boolean, tags text[], created_at timestamptz, "order" text);
//   grant select, insert, delete on items to anon;
import { PostgrestClient } from "@supabase/postgrest-js";
import { beforeAll, describe, expect, test } from "vitest";
import * as elasticsearch from "../src/filters/elasticsearch.ts";
import * as memory from "../src/filters/memory.ts";
import * as postgrest from "../src/filters/postgrest.ts";
import { cases, resolveDate, rows, type Row } from "./filters-search-cases.ts";

const POSTGREST_URL = process.env.POSTGREST_URL;
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;

const memorySpec = {
  name: memory.textField({ path: "name" }),
  amount: memory.numberField({ path: "amount" }),
  status: memory.enumField({ path: "status" }),
  done: memory.booleanField({ path: "done" }),
  tags: memory.arrayField({ path: "tags" }),
  createdAt: memory.dateField({ path: "createdAt" }),
  order: memory.enumField({ path: "order" }),
};

const expectedIds = (node: (typeof cases)[number][1]): number[] => {
  const { predicate } = memory.buildFilterNodePredicate<Row>({
    spec: memorySpec,
    node,
    resolveDate,
  });
  return rows.filter(predicate).map((r) => r.id);
};

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`${res.status} ${res.url}: ${await res.text()}`);
  return res;
}

describe.skipIf(!POSTGREST_URL)("postgrest adapter against a live PostgREST", () => {
  const base = POSTGREST_URL ?? "";
  const spec = {
    name: postgrest.textField({ column: "name" }),
    amount: postgrest.numberField({ column: "amount" }),
    status: postgrest.enumField({ column: "status" }),
    done: postgrest.booleanField({ column: "done" }),
    tags: postgrest.arrayField({ column: "tags" }),
    createdAt: postgrest.dateField({ column: "created_at" }),
    order: postgrest.enumField({ column: "order" }),
  };

  beforeAll(async () => {
    await ok(await fetch(`${base}/items?id=gte.0`, { method: "DELETE" }));
    const body = rows.map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      status: r.status,
      done: r.done,
      tags: r.tags,
      created_at: r.createdAt?.toISOString() ?? null,
      order: r.order,
    }));
    await ok(
      await fetch(`${base}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(body),
      }),
    );
  });

  test.each(cases)("%s (fetch)", async (_name, node) => {
    const { params } = postgrest.buildFilterNode({ spec, node, resolveDate });
    const qs = new URLSearchParams([["select", "id"], ["order", "id"], ...params]);
    const res = await ok(await fetch(`${base}/items?${qs}`));
    const ids = ((await res.json()) as { id: number }[]).map((r) => r.id);

    expect(ids).toEqual(expectedIds(node));
  });

  test.each(cases)("%s (postgrest-js)", async (_name, node) => {
    const { params } = postgrest.buildFilterNode({ spec, node, resolveDate });
    const query = new PostgrestClient(base).from("items").select("id").order("id");
    const { data, error } = await postgrest.applyParamsToPostgrest(query, params);

    expect(error).toBeNull();
    expect((data as { id: number }[]).map((r) => r.id)).toEqual(expectedIds(node));
  });

  test("keyset pages through every row, forward and backward", async () => {
    const keyset = postgrest.createPostgrestKeyset({
      sort: [
        { key: "createdAt", order: "desc" },
        { key: "id", order: "desc" },
      ],
      columns: { createdAt: "created_at", id: "id" },
    });
    const page = async (cursor: Record<string, unknown> | null, direction?: "backward") => {
      const qs = new URLSearchParams([
        ["select", "id,created_at"],
        ["created_at", "not.is.null"],
        ...keyset.where(cursor, direction),
        ["order", postgrest.formatOrder(keyset.orderBy(direction)) ?? ""],
        ["limit", "3"],
      ]);
      const res = await ok(await fetch(`${base}/items?${qs}`));
      return (await res.json()) as { id: number; created_at: string }[];
    };

    const seen: number[] = [];
    let cursor: Record<string, unknown> | null = null;
    for (;;) {
      const items = await page(cursor);
      if (items.length === 0) break;
      seen.push(...items.map((i) => i.id));
      const last = items.at(-1)!;
      cursor = { createdAt: new Date(last.created_at), id: last.id };
    }
    const expected = rows
      .filter((r) => r.createdAt)
      .toSorted((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime() || b.id - a.id)
      .map((r) => r.id);
    expect(seen).toEqual(expected);

    // Backward from the last row returns the rows before it (in reversed fetch order).
    const lastRow = rows.find((r) => r.id === expected.at(-1))!;
    const before = await page({ createdAt: lastRow.createdAt, id: lastRow.id }, "backward");
    expect(before.map((i) => i.id)).toEqual(expected.slice(-4, -1).reverse());
  });
});

describe.skipIf(!ELASTICSEARCH_URL)("elasticsearch adapter against a live Elasticsearch", () => {
  const base = ELASTICSEARCH_URL ?? "";
  const index = "xtandard-filters-live";
  const spec = {
    name: elasticsearch.textField({ field: "name.keyword" }),
    amount: elasticsearch.numberField({ field: "amount" }),
    status: elasticsearch.enumField({ field: "status" }),
    done: elasticsearch.booleanField({ field: "done" }),
    tags: elasticsearch.arrayField({ field: "tags" }),
    createdAt: elasticsearch.dateField({ field: "createdAt" }),
    order: elasticsearch.enumField({ field: "order" }),
  };
  const json = (body: unknown) => ({
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const search = async (body: Record<string, unknown>) => {
    const res = await ok(
      await fetch(`${base}/${index}/_search`, { method: "POST", ...json(body) }),
    );
    const out = (await res.json()) as { hits: { hits: { _id: string; sort?: unknown[] }[] } };
    return out.hits.hits;
  };

  beforeAll(async () => {
    await fetch(`${base}/${index}`, { method: "DELETE" });
    await ok(
      await fetch(`${base}/${index}`, {
        method: "PUT",
        ...json({
          mappings: {
            properties: {
              id: { type: "integer" },
              // the documented mapping: analyzed text + a keyword sub-field for filters
              name: { type: "text", fields: { keyword: { type: "keyword" } } },
              amount: { type: "double" },
              status: { type: "keyword" },
              done: { type: "boolean" },
              tags: { type: "keyword" },
              createdAt: { type: "date" },
              order: { type: "keyword" },
            },
          },
        }),
      }),
    );
    const bulk = rows
      .flatMap((r) => [
        JSON.stringify({ index: { _id: String(r.id) } }),
        JSON.stringify({ ...r, createdAt: r.createdAt?.toISOString() ?? null }),
      ])
      .join("\n");
    const res = await ok(
      await fetch(`${base}/${index}/_bulk?refresh=true`, {
        method: "POST",
        headers: { "Content-Type": "application/x-ndjson" },
        body: `${bulk}\n`,
      }),
    );
    expect(((await res.json()) as { errors: boolean }).errors).toBe(false);
  });

  test.each(cases)("%s", async (_name, node) => {
    const { query } = elasticsearch.buildFilterNode({ spec, node, resolveDate });
    const hits = await search({
      query: { bool: { filter: query ? [query] : [] } },
      sort: [{ id: "asc" }],
      size: 100,
    });

    expect(hits.map((h) => Number(h._id))).toEqual(expectedIds(node));
  });

  test("search_after keyset pages through every document", async () => {
    const keyset = elasticsearch.createElasticsearchKeyset({
      sort: [
        { key: "createdAt", order: "desc" },
        { key: "id", order: "desc" },
      ],
      fields: { createdAt: "createdAt", id: "id" },
    });
    const seen: number[] = [];
    let cursor: Record<string, unknown> | null = null;
    for (;;) {
      const hits = await search({
        query: { exists: { field: "createdAt" } },
        sort: keyset.sort(),
        search_after: keyset.searchAfter(cursor),
        size: 3,
      });
      if (hits.length === 0) break;
      seen.push(...hits.map((h) => Number(h._id)));
      const [createdAt, id] = hits.at(-1)!.sort as [number, number];
      cursor = { createdAt: new Date(createdAt), id };
    }
    const expected = rows
      .filter((r) => r.createdAt)
      .toSorted((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime() || b.id - a.id)
      .map((r) => r.id);
    expect(seen).toEqual(expected);
  });
});
