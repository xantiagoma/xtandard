/**
 * Generic `URLSearchParams` helpers (zero-dep, browser/server safe).
 */

const SUBDELIM_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["%28", "("],
  ["%29", ")"],
  ["%2C", ","],
  ["%3A", ":"],
  ["%21", "!"],
  ["%27", "'"],
];

/**
 * Serialize search params but leave the RFC-3986 sub-delims `( ) , : ! '` raw
 * instead of percent-encoding them. They round-trip through `URLSearchParams`
 * unchanged (none is `&`/`=`/`+`), so this is purely cosmetic — it keeps
 * Rison-encoded (and other structured) tokens human-readable in the address bar
 * (`(type:and,…)` instead of `%28type%3Aand%2C…`). Pass as a query-state
 * adapter's `serializeSearch`. `&`, `=` and `+` stay encoded.
 *
 * @example
 * ```ts
 * import { keepSubDelims } from "@xtandard/lib/web";
 *
 * const params = new URLSearchParams({ where: "(type:and,nodes:!())", page: "2" });
 *
 * params.toString(); // "where=%28type%3Aand%2Cnodes%3A%21%28%29%29&page=2"
 * keepSubDelims(params); // "where=(type:and,nodes:!())&page=2"
 * new URLSearchParams(keepSubDelims(params)).get("where"); // "(type:and,nodes:!())"
 * ```
 *
 * @example As the query-state adapter's serializer
 * ```tsx
 * import { NuqsAdapter, keepSubDelims } from "@xtandard/lib/tanstack";
 *
 * <NuqsAdapter serializeSearch={keepSubDelims}>
 *   <App />
 * </NuqsAdapter>;
 * ```
 */
export function keepSubDelims(params: URLSearchParams): string {
  let search = params.toString();
  for (const [encoded, raw] of SUBDELIM_REPLACEMENTS) {
    search = search.replaceAll(encoded, raw);
  }

  return search;
}
