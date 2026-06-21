/**
 * Compile-time inference assertions for the public `xantiagoma/pagination`
 * types — especially the sync/async-adaptive return inference, which no runtime
 * test catches (it can silently collapse to `Promise` or `unknown`).
 * Checked by `tsc --noEmit` (via `bun run check`); not run by the test runner.
 */
import type { Equal, Expect } from "type-testing";

import type { MaybePromise } from "../src/types.ts";
import { createCursorCodec } from "../src/cursor-codec.ts";
import { createPaginator, type Paginated } from "../src/pagination.ts";

// --- sync/async-adaptive: paginate() return type ----------------------------

// All-sync fetchers → `paginate` returns a plain `Paginated<T>` (no await).
const syncPaginator = createPaginator({
  fetchOffset: () => ({ items: [{ id: 1 }] }),
});

export type _SyncPaginate = Expect<
  Equal<ReturnType<typeof syncPaginator.paginate>, Paginated<{ id: number }>>
>;

// Any async stage → `paginate` returns `MaybePromise<Paginated<T>>`.
const asyncPaginator = createPaginator({
  fetchOffset: async () => ({ items: [{ id: 1 }] }),
});

export type _AsyncPaginate = Expect<
  Equal<ReturnType<typeof asyncPaginator.paginate>, MaybePromise<Paginated<{ id: number }>>>
>;

// item type flows into the iteration helpers
export type _PagesYield = Expect<
  Equal<ReturnType<typeof syncPaginator.pages>, AsyncGenerator<Paginated<{ id: number }>>>
>;

// --- createCursorCodec<T> round-trips T (sync by default) -------------------

const codec = createCursorCodec<{ id: number }>();

export type _CodecDecode = Expect<Equal<ReturnType<typeof codec.decode>, { id: number }>>;
export type _CodecEncode = Expect<Equal<Parameters<typeof codec.encode>[0], { id: number }>>;
