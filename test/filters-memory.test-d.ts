/**
 * Compile-time inference assertions for `@xtandard/lib/filters/memory`.
 * Checked by `tsc --noEmit` (via `bun run check`); not run by the test runner.
 */
import type { Equal, Expect } from "type-testing";

import type { Paginated, PaginatorSync } from "../src/entry-pagination.ts";
import {
  buildComparator,
  buildFilterNodePredicate,
  buildFilterPredicate,
  createMemoryKeyset,
  createMemoryPaginator,
  dateField,
  numberField,
  textField,
  toFilterPredicate,
  type FilterPredicate,
  type MemoryFieldSpec,
  type RowComparator,
} from "../src/filters/memory.ts";

type Task = { id: number; name: string; cents: number; createdAt: Date };
declare const tasks: Task[];

// A getter types its row; a string path leaves the row open.
const byGetter = numberField({ path: (t: Task) => t.cents / 100 });
export type _GetterSpec = Expect<Equal<typeof byGetter, MemoryFieldSpec<Task>>>;
const byPath = textField({ path: "name" });
export type _PathSpec = Expect<Equal<typeof byPath, MemoryFieldSpec<any>>>;

// The predicate takes the row type the spec's getters declare, even mixed with string paths.
const { predicate } = buildFilterPredicate({
  spec: { total: byGetter, name: byPath, createdAt: dateField({ path: "createdAt" }) },
  filters: [],
});
export type _PredicateRow = Expect<Equal<typeof predicate, FilterPredicate<Task>>>;
export type _PredicateFn = Expect<Equal<FilterPredicate<Task>, (row: Task) => boolean>>;
tasks.filter(predicate);

// …or pin the row type explicitly.
const { predicate: pinned } = buildFilterNodePredicate<Task>({
  spec: { name: textField({ path: "name" }) },
  node: { type: "and", nodes: [] },
});
export type _Pinned = Expect<Equal<typeof pinned, FilterPredicate<Task>>>;

// A getter for a different row type is a compile error.
buildFilterPredicate<Task>({
  // @ts-expect-error -- the getter reads `{ other: string }`, not `Task`
  spec: { other: textField({ path: (r: { other: string }) => r.other }) },
  filters: [],
});

export type _ToPredicate = Expect<
  Equal<ReturnType<typeof toFilterPredicate<Task>>, FilterPredicate<Task>>
>;

const { compare } = buildComparator<Task>({ sort: [], paths: { name: "name" } });
export type _Comparator = Expect<Equal<typeof compare, RowComparator<Task>>>;
tasks.sort(compare);

const keyset = createMemoryKeyset<Task>({ sort: [{ key: "id" }] });
export type _KeysetWhere = Expect<
  Equal<ReturnType<typeof keyset.where>, FilterPredicate<Task> | undefined>
>;

// The paginator is all-sync: `paginate` returns a plain `Paginated<Task>`, never a Promise.
const paginator = createMemoryPaginator({ rows: tasks, sort: [{ key: "id" }] });
export type _Paginator = Expect<Equal<typeof paginator, PaginatorSync<Task>>>;
const page = paginator.paginate({ type: "page", page: 1, pageSize: 10 });
export type _Page = Expect<Equal<typeof page, Paginated<Task>>>;
