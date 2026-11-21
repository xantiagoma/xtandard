/**
 * Evaluates the compiled filter AST in memory: a plain `(row) => boolean` predicate with the
 * same semantics as the SQL adapters, a sort comparator, and synchronous offset/cursor
 * pagination over arrays. Zero dependencies; safe for the frontend.
 *
 * `buildFilterPredicate` / `buildFilterNodePredicate` compile and render in one step,
 * `toFilterPredicate` renders a pre-compiled `CompiledWhere`, `applyFiltersToArray` filters an
 * array, `buildComparator` turns a `Sort` into an `Array.prototype.sort` comparator, and
 * `createMemoryKeyset` / `createMemoryPaginator` page through the result. Matching follows SQL:
 * three-valued NULL logic (`ne`/`notInArray`/`notIlike` never match NULL, `not` keeps UNKNOWN),
 * `LIKE` patterns with `%`/`_`/`\` escapes, and case folding, NULL ordering and NULL arrays per
 * `dialect` (`"postgres"`, the default, or `"sqlite"`). A cross-adapter test checks it returns
 * the same rows as the knex, kysely and drizzle adapters on SQLite.
 *
 * Import from `@xtandard/lib/filters/memory`.
 *
 * @example
 * ```ts
 * import { applyFiltersToArray, buildComparator, createMemoryPaginator, textField, numberField } from "@xtandard/lib/filters/memory";
 *
 * const spec = { name: textField({ path: "name" }), amount: numberField({ path: "amount" }) };
 * const matching = applyFiltersToArray(rows, { spec, filters, resolveDate });
 * const { compare } = buildComparator({ sort, paths: { name: "name", amount: "amount" } });
 * const sorted = [...matching].sort(compare);
 * // or page it: createMemoryPaginator({ rows: matching, sort: [{ key: "amount" }, { key: "id" }] })
 * ```
 *
 * @module filters/memory
 */

export * from "./filters/memory.ts";
