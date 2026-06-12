import { describe, expect, test } from "vitest";
import { type CursorWindow, createPaginator } from "../src/pagination.ts";
import {
  infinitePaginationOptions,
  toRelayConnection,
  toRestEnvelope,
} from "../src/pagination-output.ts";

type Item = { id: number };

const DB: Item[] = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));

function fetchCursor({ limit, cursor, direction }: CursorWindow<{ id: number }>) {
  const id = cursor?.id;
  if (direction === "backward") {
    const rows = DB.filter((item) => (id === undefined ? true : item.id < id))
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
    return { items: rows };
  }
  return { items: DB.filter((item) => (id === undefined ? true : item.id > id)).slice(0, limit) };
}

const paginator = createPaginator({
  fetchCursor,
  cursor: { fromItem: (item: Item) => ({ id: item.id }) },
});

describe("toRelayConnection", () => {
  test("builds edges with per-node cursors", async () => {
    const result = await paginator.paginate({ type: "cursor", limit: 3 });
    const connection = toRelayConnection(result, paginator.cursorFor);

    expect(connection.edges).toHaveLength(3);
    expect(connection.edges.map((e) => e.node.id)).toEqual([1, 2, 3]);
    expect(connection.edges[0]!.cursor).toBe(paginator.cursorFor({ id: 1 }));
    expect(connection.pageInfo).toEqual({
      hasNextPage: true,
      hasPreviousPage: false,
      startCursor: paginator.cursorFor({ id: 1 }),
      endCursor: paginator.cursorFor({ id: 3 }),
    });
  });

  test("edges get null cursors without cursorFor", async () => {
    const result = await paginator.paginate({ type: "cursor", limit: 2 });
    const connection = toRelayConnection(result);
    expect(connection.edges.every((e) => e.cursor === null)).toBe(true);
    expect(connection.pageInfo.endCursor).toBeTruthy();
  });

  test("empty results produce an empty connection", async () => {
    const result = await paginator.paginate({
      type: "cursor",
      limit: 5,
      cursor: paginator.cursorFor({ id: 12 }),
    });
    const connection = toRelayConnection(result, paginator.cursorFor);
    expect(connection.edges).toEqual([]);
    expect(connection.pageInfo.startCursor).toBeNull();
    expect(connection.pageInfo.hasNextPage).toBe(false);
  });
});

describe("toRestEnvelope", () => {
  test("wraps items as data and pageInfo as meta", async () => {
    const result = await paginator.paginate({ type: "cursor", limit: 4 });
    const envelope = toRestEnvelope(result);
    expect(envelope.data).toBe(result.items);
    expect(envelope.meta).toBe(result.pageInfo);
  });
});

describe("infinitePaginationOptions", () => {
  const options = infinitePaginationOptions(paginator, { pageSize: 5 });

  test("starts from a null page param", () => {
    expect(options.initialPageParam).toBeNull();
  });

  test("queryFn returns a real Promise even though the paginator is sync", async () => {
    const result = options.queryFn({ pageParam: null, direction: "forward" });
    expect(result).toBeInstanceOf(Promise);
    expect((await result).items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
  });

  test("queryFn + getNextPageParam walk the whole set", async () => {
    const seen: number[] = [];
    let pageParam: string | null | undefined = options.initialPageParam;
    while (pageParam !== undefined) {
      const page = await options.queryFn({ pageParam, direction: "forward" });
      seen.push(...page.items.map((i) => i.id));
      pageParam = options.getNextPageParam(page);
    }
    expect(seen).toEqual(DB.map((i) => i.id));
  });

  test("getNextPageParam returns undefined on the last page", async () => {
    const lastPage = await options.queryFn({
      pageParam: paginator.cursorFor({ id: 10 }),
      direction: "forward",
    });
    expect(lastPage.items.map((i) => i.id)).toEqual([11, 12]);
    expect(options.getNextPageParam(lastPage)).toBeUndefined();
  });

  test("backward direction fetches the previous page", async () => {
    const page = await options.queryFn({
      pageParam: paginator.cursorFor({ id: 8 }),
      direction: "backward",
    });
    expect(page.items.map((i) => i.id)).toEqual([3, 4, 5, 6, 7]);
    expect(options.getPreviousPageParam(page)).toBe(paginator.cursorFor({ id: 3 }));
  });

  test("getPreviousPageParam returns undefined at the very start", async () => {
    const page = await options.queryFn({
      pageParam: paginator.cursorFor({ id: 4 }),
      direction: "backward",
    });
    expect(page.items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(options.getPreviousPageParam(page)).toBeUndefined();
  });

  test("defaults pageSize to 20 when options are omitted", async () => {
    const defaulted = infinitePaginationOptions(paginator);
    const page = await defaulted.queryFn({ pageParam: null, direction: "forward" });
    expect(page.pageInfo.endCursor).toBe(paginator.cursorFor(DB[DB.length - 1]!));
  });

  test("page params fall back to undefined when cursors are null", () => {
    const synthetic = {
      items: [],
      pageInfo: { hasNextPage: true, hasPreviousPage: true, startCursor: null, endCursor: null },
    };
    expect(options.getNextPageParam(synthetic)).toBeUndefined();
    expect(options.getPreviousPageParam(synthetic)).toBeUndefined();
  });
});
