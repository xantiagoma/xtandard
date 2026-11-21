// Shared by `@xtandard/lib/filters/sql-tag` and `@xtandard/lib/pagination/sql-tag`: the
// structural tag types (re-exported by both entries) and the two internal builders.

/**
 * The structural shape of a tagged-template SQL client: called as a tag it returns a lazy
 * query that nests as a fragment, and called with one string it returns a quoted identifier.
 * Bun's `sql` / `new SQL(…)` and postgres.js's `postgres(…)` (plus its transaction and reserved
 * `sql`) all fit, so the `sql-tag` adapters never import either.
 */
export type SqlTag = {
  (strings: TemplateStringsArray, ...values: any[]): unknown;
  (identifier: string): unknown;
};

/**
 * The fragment type a {@link SqlTag} produces, used to type what the `sql-tag` adapters return:
 * the type your client's `sql.unsafe` returns (`PendingQuery` for postgres.js, `SQL.Query` for
 * Bun), else the return type of its tag call (for a tag of your own without `unsafe`, declare
 * the tag signature before the identifier one, like {@link SqlTag}). It isn't read from the
 * tag call of a client first because TypeScript infers from an overloaded function's last
 * signature, which for Bun is the `sql(value)` helper.
 */
export type SqlTagFragment<S> = S extends { unsafe(...args: any[]): infer F }
  ? F
  : S extends {
        (strings: TemplateStringsArray, ...values: any[]): infer F;
        (identifier: string): unknown;
      }
    ? F
    : S extends (strings: TemplateStringsArray, ...values: any[]) => infer F
      ? F
      : unknown;

/**
 * What a field or sort key reads: a column string (`"name"` or `"posts.name"`, validated, then
 * quoted by your client's `sql(identifier)`) or any fragment from your `sql` tag (e.g.
 * `` sql`lower(name)` ``), embedded as it is.
 */
export type SqlTagTarget = string | object;

// Server-owned identifiers only: `col` or `table.col`. The client quotes them (`sql(name)`
// splits on dots and quotes each part); validating first keeps request data, quotes and
// anything that isn't a plain name out of the query, the same rule as the knex adapter.
const IDENTIFIER_PART = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Resolve a column target to something embeddable in a `sql` template. */
export function sqlTagRef(sql: SqlTag, target: SqlTagTarget, who: string): unknown {
  if (typeof target !== "string") return target;
  if (!target.split(".").every((part) => IDENTIFIER_PART.test(part))) {
    throw new Error(`${who}: invalid SQL identifier "${target}"`);
  }

  return sql(target);
}

/**
 * Join fragments with a separator as a balanced tree of fixed templates (depth log n, so long
 * `IN` lists don't recurse deeply in the client). Every keyword lives in template text, never
 * in an interpolated string. No parts give an empty fragment.
 */
export function sqlTagJoin(sql: SqlTag, parts: unknown[], sep: "and" | "or" | "comma"): unknown {
  if (parts.length <= 1) return parts.length === 1 ? parts[0] : sql``;
  const mid = parts.length >> 1;
  const left = sqlTagJoin(sql, parts.slice(0, mid), sep);
  const right = sqlTagJoin(sql, parts.slice(mid), sep);
  if (sep === "and") return sql`${left} AND ${right}`;
  if (sep === "or") return sql`${left} OR ${right}`;

  return sql`${left}, ${right}`;
}
