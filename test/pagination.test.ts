import { describe, expect, expectTypeOf, test } from "vitest";
import {
  type CursorWindow,
  type OffsetWindow,
  type Paginated,
  createPaginator,
  toOffsetWindow,
} from "../src/pagination.ts";
import { createCursorCodec } from "../src/cursor-codec.ts";
import { isPromise } from "../src/is-promise.ts";

type Item = { id: number; name: string };

// 1..50, ascending by id — stands in for any data source
const DB: Item[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `item-${i + 1}` }));

function fetchOffset({ limit, offset }: OffsetWindow) {
  return { items: DB.slice(offset, offset + limit) };
}

function fetchOffsetWithTotal(window: OffsetWindow) {
  return { ...fetchOffset(window), totalItems: DB.length };
}

// keyset-style fetcher: forward = ids ascending after cursor,
// backward = ids descending before cursor (flipped order, as a SQL fetcher would return)
function fetchCursor({ limit, cursor, direction }: CursorWindow<{ id: number }>) {
  const id = cursor?.id;
  if (direction === "backward") {
    const rows = DB.filter((item) => (id === undefined ? true : item.id < id))
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
    return { items: rows };
  }
  const rows = DB.filter((item) => (id === undefined ? true : item.id > id)).slice(0, limit);
  return { items: rows };
}

const cursorConfig = { fromItem: (item: Item) => ({ id: item.id }) };

describe("toOffsetWindow", () => {
  test("converts page input (1-based)", () => {
    expect(toOffsetWindow({ type: "page", page: 3, pageSize: 20 })).toEqual({
      limit: 20,
      offset: 40,
    });
  });

  test("passes offset input through", () => {
    expect(toOffsetWindow({ type: "offset", limit: 10, offset: 25 })).toEqual({
      limit: 10,
      offset: 25,
    });
  });

  test("clamps invalid values", () => {
    expect(toOffsetWindow({ type: "page", page: 0, pageSize: -5 })).toEqual({
      limit: 1,
      offset: 0,
    });
    expect(toOffsetWindow({ type: "offset", limit: 0, offset: -10 })).toEqual({
      limit: 1,
      offset: 0,
    });
  });
});

describe("createPaginator — page/offset", () => {
  const paginator = createPaginator({ fetchOffset });

  test("returns the requested page", async () => {
    const result = await paginator.paginate({ type: "page", page: 2, pageSize: 10 });
    expect(result.items.map((i) => i.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(result.pageInfo).toMatchObject({
      page: 2,
      pageSize: 10,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  test("computes hasNextPage via lookahead without a total", async () => {
    const last = await paginator.paginate({ type: "page", page: 5, pageSize: 10 });
    expect(last.items).toHaveLength(10);
    expect(last.pageInfo.hasNextPage).toBe(false);
    expect(last.pageInfo.totalItems).toBeUndefined();
  });

  test("first page has no previous", async () => {
    const first = await paginator.paginate({ type: "offset", limit: 10, offset: 0 });
    expect(first.pageInfo.hasPreviousPage).toBe(false);
    expect(first.pageInfo.hasNextPage).toBe(true);
  });

  test("includes totals when the fetcher reports them", async () => {
    const withTotal = createPaginator({ fetchOffset: fetchOffsetWithTotal });
    const result = await withTotal.paginate({ type: "page", page: 1, pageSize: 15 });
    expect(result.pageInfo.totalItems).toBe(50);
    expect(result.pageInfo.totalPages).toBe(4);
  });

  test("offset input maps to page metadata", async () => {
    const result = await paginator.paginate({ type: "offset", limit: 10, offset: 30 });
    expect(result.pageInfo.page).toBe(4);
    expect(result.pageInfo.pageSize).toBe(10);
  });

  test("clamps to maxLimit", async () => {
    const capped = createPaginator({ fetchOffset, maxLimit: 5 });
    const result = await capped.paginate({ type: "page", page: 1, pageSize: 100 });
    expect(result.items).toHaveLength(5);
    expect(result.pageInfo.pageSize).toBe(5);
  });

  test("includes start/end cursors when cursor config is present", async () => {
    const withCursors = createPaginator({ fetchOffset, cursor: cursorConfig });
    const result = await withCursors.paginate({ type: "page", page: 1, pageSize: 3 });
    expect(result.pageInfo.startCursor).toBeTruthy();
    expect(result.pageInfo.endCursor).toBeTruthy();
  });

  test("throws without fetchOffset", () => {
    const cursorOnly = createPaginator({ fetchCursor, cursor: cursorConfig });
    expect(() => cursorOnly.paginate({ type: "page", page: 1, pageSize: 10 })).toThrow(
      /requires a `fetchOffset` fetcher/,
    );
  });
});

describe("createPaginator — cursor", () => {
  const paginator = createPaginator({ fetchCursor, cursor: cursorConfig });

  test("first page without a cursor", async () => {
    const result = await paginator.paginate({ type: "cursor", limit: 10 });
    expect(result.items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.hasPreviousPage).toBe(false);
  });

  test("walks forward across pages until exhausted", async () => {
    const seen: number[] = [];
    let cursor: string | null | undefined;
    let hasNext = true;
    while (hasNext) {
      const result = await paginator.paginate({ type: "cursor", limit: 20, cursor });
      seen.push(...result.items.map((i) => i.id));
      cursor = result.pageInfo.endCursor;
      hasNext = result.pageInfo.hasNextPage;
    }
    expect(seen).toEqual(DB.map((i) => i.id));
  });

  test("paginates backward in natural order", async () => {
    // position at item 21, scroll up for newer items
    const token = paginator.cursorFor(DB[20]!);
    const result = await paginator.paginate({
      type: "cursor",
      limit: 5,
      cursor: token,
      direction: "backward",
    });
    expect(result.items.map((i) => i.id)).toEqual([16, 17, 18, 19, 20]);
    expect(result.pageInfo.hasPreviousPage).toBe(true); // more items above
    expect(result.pageInfo.hasNextPage).toBe(true); // came from below
  });

  test("backward pagination exhausts at the start", async () => {
    const token = paginator.cursorFor(DB[3]!); // item 4
    const result = await paginator.paginate({
      type: "cursor",
      limit: 10,
      cursor: token,
      direction: "backward",
    });
    expect(result.items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(result.pageInfo.hasPreviousPage).toBe(false);
  });

  test("empty results yield null cursors", async () => {
    const token = paginator.cursorFor(DB[49]!); // last item
    const result = await paginator.paginate({ type: "cursor", limit: 10, cursor: token });
    expect(result.items).toEqual([]);
    expect(result.pageInfo.startCursor).toBeNull();
    expect(result.pageInfo.endCursor).toBeNull();
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  test("cursorFor round-trips through paginate", async () => {
    const first = await paginator.paginate({ type: "cursor", limit: 1 });
    expect(first.pageInfo.endCursor).toBe(paginator.cursorFor(DB[0]!));
  });

  test("throws without cursor capability", () => {
    const offsetOnly = createPaginator({ fetchOffset });
    expect(() => offsetOnly.paginate({ type: "cursor", limit: 10 })).toThrow(
      /requires a `fetchCursor` fetcher and `cursor` config/,
    );
    expect(() => offsetOnly.cursorFor(DB[0]!)).toThrow(/`cursor.fromItem` is required/);
  });

  test("respects maxLimit", async () => {
    const capped = createPaginator({ fetchCursor, cursor: cursorConfig, maxLimit: 3 });
    const result = await capped.paginate({ type: "cursor", limit: 50 });
    expect(result.items).toHaveLength(3);
  });

  test("includes totalItems when the cursor fetcher reports it", async () => {
    const withTotal = createPaginator({
      fetchCursor: (window: CursorWindow<{ id: number }>) => ({
        ...fetchCursor(window),
        totalItems: DB.length,
      }),
      cursor: cursorConfig,
    });
    const result = await withTotal.paginate({ type: "cursor", limit: 5 });
    expect(result.pageInfo.totalItems).toBe(50);
  });
});

describe("createPaginator — pages()/items() iteration", () => {
  const paginator = createPaginator({ fetchOffset, fetchCursor, cursor: cursorConfig });

  test("pages() walks cursor pagination until exhausted", async () => {
    const sizes: number[] = [];
    for await (const page of paginator.pages({ type: "cursor", limit: 15 })) {
      sizes.push(page.items.length);
    }
    expect(sizes).toEqual([15, 15, 15, 5]);
  });

  test("items() yields every item across pages, lazily, in order", async () => {
    const seen: number[] = [];
    for await (const item of paginator.items({ type: "cursor", limit: 12 })) {
      seen.push(item.id);
    }
    expect(seen).toEqual(DB.map((i) => i.id));
  });

  test("works with offset/page inputs, resuming mid-set", async () => {
    const seen: number[] = [];
    for await (const item of paginator.items({ type: "offset", limit: 20, offset: 45 })) {
      seen.push(item.id);
    }
    expect(seen).toEqual([46, 47, 48, 49, 50]);

    const pageSizes: number[] = [];
    for await (const page of paginator.pages({ type: "page", page: 4, pageSize: 15 })) {
      pageSizes.push(page.items.length);
    }
    expect(pageSizes).toEqual([5]);
  });

  test("offset iteration advances across multiple pages", async () => {
    const seen: number[] = [];
    for await (const item of paginator.items({ type: "page", page: 3, pageSize: 15 })) {
      seen.push(item.id);
    }
    // page 3 (31–45), then offset advances to the final partial page (46–50)
    expect(seen).toEqual([
      31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
    ]);
  });

  test("backward iteration scrolls up in natural order per page", async () => {
    const token = paginator.cursorFor(DB[10]!); // item 11
    const seen: number[] = [];
    for await (const page of paginator.pages({
      type: "cursor",
      limit: 4,
      cursor: token,
      direction: "backward",
    })) {
      seen.push(...page.items.map((i) => i.id));
    }
    expect(seen).toEqual([7, 8, 9, 10, 3, 4, 5, 6, 1, 2]);
  });

  test("is lazy — stops fetching when the consumer breaks", async () => {
    let fetches = 0;
    const counting = createPaginator({
      fetchCursor: (window: CursorWindow<{ id: number }>) => {
        fetches += 1;
        return fetchCursor(window);
      },
      cursor: cursorConfig,
    });
    for await (const page of counting.pages({ type: "cursor", limit: 10 })) {
      void page;
      break; // consumer stops after the first page
    }
    expect(fetches).toBe(1);
  });

  test("guards against a cursor that does not advance", async () => {
    const stuck = createPaginator({
      // always returns the same single row → same endCursor every time
      fetchCursor: () => ({ items: [DB[0]!] }),
      cursor: cursorConfig,
    });
    const pages = [];
    const first = await stuck.paginate({ type: "cursor", limit: 1 });
    for await (const page of stuck.pages({
      type: "cursor",
      limit: 1,
      cursor: first.pageInfo.endCursor,
    })) {
      pages.push(page);
    }
    expect(pages).toHaveLength(1); // stopped, not an infinite loop
  });

  test("empty first page ends iteration immediately", async () => {
    const token = paginator.cursorFor(DB[49]!); // last item
    const pages = [];
    for await (const page of paginator.pages({ type: "cursor", limit: 10, cursor: token })) {
      pages.push(page);
    }
    expect(pages).toHaveLength(1);
    expect(pages[0]!.items).toEqual([]);
  });
});

describe("createPaginator — sync/async adaptive tiers", () => {
  test("all-sync config returns plain values, no await needed (types + runtime)", () => {
    const paginator = createPaginator({ fetchOffset, fetchCursor, cursor: cursorConfig });

    const result = paginator.paginate({ type: "page", page: 1, pageSize: 3 });
    expectTypeOf(result).toEqualTypeOf<Paginated<Item>>();
    expect(isPromise(result)).toBe(false);
    expect(result.items.map((i) => i.id)).toEqual([1, 2, 3]);

    // sync cursor walking
    const first = paginator.paginate({ type: "cursor", limit: 4 });
    expect(isPromise(first)).toBe(false);
    const second = paginator.paginate({
      type: "cursor",
      limit: 4,
      cursor: first.pageInfo.endCursor,
    });
    expect(second.items.map((i) => i.id)).toEqual([5, 6, 7, 8]);

    const token = paginator.cursorFor(DB[0]!);
    expectTypeOf(token).toEqualTypeOf<string>();
    expect(typeof token).toBe("string");
  });

  test("async fetchCursor → paginate returns a Promise, cursorFor stays sync", async () => {
    const paginator = createPaginator({
      fetchCursor: async (window: CursorWindow<{ id: number }>) => fetchCursor(window),
      cursor: cursorConfig,
    });

    const result = paginator.paginate({ type: "cursor", limit: 3 });
    expect(isPromise(result)).toBe(true);
    expect((await result).items.map((i) => i.id)).toEqual([1, 2, 3]);

    const token = paginator.cursorFor(DB[0]!);
    expectTypeOf(token).toEqualTypeOf<string>();
    expect(typeof token).toBe("string");
  });

  test("async fetchOffset → paginate returns a Promise with correct page data", async () => {
    const paginator = createPaginator({
      fetchOffset: async (window: OffsetWindow) => fetchOffset(window),
      cursor: cursorConfig,
    });

    const result = paginator.paginate({ type: "page", page: 2, pageSize: 3 });
    expect(isPromise(result)).toBe(true);
    const page = await result;
    expect(page.items.map((i) => i.id)).toEqual([4, 5, 6]);
    expect(page.pageInfo.startCursor).toBe(paginator.cursorFor(DB[3]!));
    expect(page.pageInfo.endCursor).toBe(paginator.cursorFor(DB[5]!));
  });

  test("async codec → cursorFor may return a Promise; both paths resolve through it", async () => {
    const asyncCodec = createCursorCodec<{ id: number }>({
      encoder: async (str) => `x${str}`,
      decoder: async (token) => token.slice(1),
    });

    const paginator = createPaginator({
      fetchOffset,
      fetchCursor,
      cursor: { ...cursorConfig, codec: asyncCodec },
    });

    const token = paginator.cursorFor(DB[0]!);
    expect(isPromise(token)).toBe(true);
    expect(typeof (await token)).toBe("string");

    // cursor path round-trips through the async codec
    const first = await paginator.paginate({ type: "cursor", limit: 4 });
    expect(first.items.map((i) => i.id)).toEqual([1, 2, 3, 4]);
    expect(first.pageInfo.endCursor).toBe(await paginator.cursorFor(DB[3]!));
    const second = await paginator.paginate({
      type: "cursor",
      limit: 4,
      cursor: first.pageInfo.endCursor,
    });
    expect(second.items.map((i) => i.id)).toEqual([5, 6, 7, 8]);

    // offset path: sync fetcher + async codec → still a Promise (cursorPair is async)
    const offsetResult = paginator.paginate({ type: "page", page: 1, pageSize: 3 });
    expect(isPromise(offsetResult)).toBe(true);
    const offsetPage = await offsetResult;
    expect(offsetPage.pageInfo.startCursor).toBe(await paginator.cursorFor(DB[0]!));
    expect(offsetPage.pageInfo.endCursor).toBe(await paginator.cursorFor(DB[2]!));
  });
});
