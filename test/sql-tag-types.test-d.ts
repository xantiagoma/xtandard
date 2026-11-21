/// <reference types="bun-types" />
/**
 * Compile-time checks that the `sql-tag` adapters accept the real Bun.sql and postgres.js
 * clients, and that what they return is typed as each client's own fragment, so it can be
 * embedded in that client's template. Checked by `tsc --noEmit` (via `bun run check`); not
 * run by the test runner.
 */
import { SQL } from "bun";
import postgres, { type PendingQuery, type TransactionSql } from "postgres";
import type { Equal, Expect } from "type-testing";

import {
  buildFilterNode,
  buildOrderBy,
  buildWhere,
  type SqlTag,
  type SqlTagFragment,
  textField,
  toSqlTagWhere,
} from "../src/filters/sql-tag.ts";
import { toSqlTagKeyset } from "../src/pagination-sql-tag.ts";

const spec = { name: textField({ column: "name" }) };

// ── postgres.js ──────────────────────────────────────────────────────────────
const pg = postgres();
const pgWhere = buildWhere({ sql: pg, spec, filters: [] }).where;
export type _PgWhere = Expect<Equal<typeof pgWhere, PendingQuery<any[]> | undefined>>;
export const _pgEmbeds = pg`select * from t where ${pgWhere ?? pg`true`}`;

// A transaction's `sql` is a tag too.
declare const tx: TransactionSql;
const txOrder = buildOrderBy({ sql: tx, sort: [], columns: {} }).orderBy;
export type _TxOrder = Expect<Equal<typeof txOrder, PendingQuery<any[]> | undefined>>;

// ── Bun.sql ──────────────────────────────────────────────────────────────────
const bun = new SQL();
const bunWhere = buildFilterNode({
  sql: bun,
  spec,
  node: { type: "column", field: "name", filter: { kind: "text", operator: "isNull" } },
  dialect: "sqlite",
}).where;
export type _BunWhere = Expect<Equal<typeof bunWhere, SQL.Query<unknown> | undefined>>;
export const _bunEmbeds = bun`select * from t where ${bunWhere}`;

const bunKeyset = toSqlTagKeyset(bun, { id: "id" });
export type _BunOrder = Expect<Equal<ReturnType<typeof bunKeyset.orderBy>, SQL.Query<unknown>>>;
const pgKeyset = toSqlTagKeyset(pg, { id: "id" });
export type _PgKeysetWhere = Expect<
  Equal<ReturnType<typeof pgKeyset.where>, PendingQuery<any[]> | undefined>
>;

// ── any structural tag ───────────────────────────────────────────────────────
type Recorded = { strings: readonly string[]; values: unknown[] };
declare const fake: {
  (strings: TemplateStringsArray, ...values: unknown[]): Recorded;
  (identifier: string): { identifier: string };
};
const fakeWhere = toSqlTagWhere({ sql: fake, where: null, columns: {} });
export type _FakeWhere = Expect<Equal<typeof fakeWhere, Recorded | undefined>>;
export type _FakeFragment = Expect<Equal<SqlTagFragment<typeof fake>, Recorded>>;

// Not a tag: a function that can't take a template.
// @ts-expect-error — `(x: number) => number` is not a SqlTag
buildWhere({ sql: (x: number) => x, spec, filters: [] });
export type _NotATag = Expect<Equal<((x: number) => number) extends SqlTag ? true : false, false>>;
