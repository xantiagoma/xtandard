/**
 * Renders the compiled filter AST to an Elasticsearch / OpenSearch Query DSL clause (no client
 * dependency; plain objects for `@elastic/elasticsearch`, `@opensearch-project/opensearch` or a
 * raw `_search` body).
 *
 * Scalars → `term`/`range`; `inArray` → `terms`; null checks → `exists`; `contains`/`endsWith`
 * → `wildcard` and `startsWith` → `prefix`, both `case_insensitive` (ES 7.10+ / OpenSearch);
 * `like`/`ilike` patterns → `wildcard` (`%` → `*`, `_` → `?`). `and`/`or` → `bool.filter` /
 * `bool.should`; negation keeps SQL's NULL semantics (an `exists` guard, so `ne`/`not` never
 * match a document without the field). `arrayContains` → one `term` per value, `arrayOverlaps`
 * → `terms`; `arrayContained` has no script-free equivalent and throws. Text fields must be
 * `keyword` (or a `.keyword` sub-field). Sorting → `buildSort`, `search_after` keyset
 * pagination → `createElasticsearchKeyset`.
 *
 * Import from `@xtandard/lib/filters/elasticsearch`.
 *
 * @example
 * ```ts
 * import { buildQuery, textField, numberField } from "@xtandard/lib/filters/elasticsearch";
 *
 * const spec = { name: textField({ field: "name.keyword" }), amount: numberField({ field: "amount" }) };
 * const { query } = buildQuery({ spec, filters, resolveDate });
 * // query → { bool: { filter: [{ wildcard: { "name.keyword": { value: "*ab*", case_insensitive: true } } }, …] } }
 * await client.search({ index: "tasks", query: { bool: { filter: query ? [query] : [] } } });
 * ```
 *
 * @module filters/elasticsearch
 */

export * from "./filters/elasticsearch.ts";
