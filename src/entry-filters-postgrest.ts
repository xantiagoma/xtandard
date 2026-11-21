/**
 * Renders the compiled filter AST to PostgREST / Supabase query parameters (no driver
 * dependency): `col=op.value` pairs for a plain `fetch` (`new URLSearchParams(params)`), or
 * applied to a postgrest-js / supabase-js builder with `applyParamsToPostgrest`.
 *
 * `eq`/`ne`/`lt`/… → `eq.`/`neq.`/`lt.`; `inArray` → `in.(…)`; null checks → `is.null` /
 * `not.is.null`; `contains`/`startsWith`/`endsWith` → `ilike` with `*` wildcards (the user's
 * `%`/`_`/`\` escaped); array ops → `cs`/`cd`/`ov` with a Postgres array literal. `or`/`not`
 * groups → `or=(…)` / `not.and=(…)`, with values double-quoted when they hold a reserved
 * character (`, . : * ( )`). PostgREST turns every `*` in a LIKE pattern into `%`, so a pattern
 * with a literal `*` falls back to `match`/`imatch` (POSIX regex). Sorting → `buildOrder`
 * (`order=col.desc.nullslast`), keyset pagination → `createPostgrestKeyset`.
 *
 * Import from `@xtandard/lib/filters/postgrest`.
 *
 * @example
 * ```ts
 * import { buildParams, textField, numberField } from "@xtandard/lib/filters/postgrest";
 *
 * const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };
 * const { params } = buildParams({ spec, filters, resolveDate });
 * // params → [["name", "ilike.*ab*"], ["amount", "gte.100"]]
 * const res = await fetch(`${POSTGREST_URL}/tasks?${new URLSearchParams(params)}`);
 * // or with supabase-js: applyParamsToPostgrest(supabase.from("tasks").select(), params)
 * ```
 *
 * @module filters/postgrest
 */

export * from "./filters/postgrest.ts";
