/**
 * Compile-time checks that the PostgREST adapter fits postgrest-js / supabase-js and the
 * standard `URLSearchParams`. Checked by `tsc --noEmit` (via `bun run check`); not run by the
 * test runner.
 */
import { PostgrestClient } from "@supabase/postgrest-js";
import type { Equal, Expect, Extends } from "type-testing";

import {
  applyFiltersToPostgrest,
  applyParamsToPostgrest,
  buildOrder,
  numberField,
  type PostgrestFilterBuilder,
  type PostgrestParams,
} from "../src/filters/postgrest.ts";

const query = new PostgrestClient("http://localhost:3000").from("tasks").select("*");
type Query = typeof query;

// postgrest-js's filter builder satisfies the structural builder type.
export type _BuilderFits = Expect<Extends<Query, PostgrestFilterBuilder>>;

// The apply helpers return the caller's builder type, so supabase-js chaining stays typed.
const applied = applyParamsToPostgrest(query, []);
export type _ApplyParamsKeepsType = Expect<Equal<typeof applied, Query>>;
const appliedFilters = applyFiltersToPostgrest(query, {
  spec: { amount: numberField({ column: "amount" }) },
  filters: [],
});
export type _ApplyFiltersKeepsType = Expect<Equal<typeof appliedFilters, Query>>;

// Params are a valid `URLSearchParams` init.
export type _ParamsAreSearchParamsInit = Expect<
  Extends<PostgrestParams, ConstructorParameters<typeof URLSearchParams>[0]>
>;

// An order term spreads straight into postgrest-js's `.order(column, options)`.
const { order } = buildOrder({ sort: [], columns: {} });
for (const t of order) applied.order(t.column, t);
