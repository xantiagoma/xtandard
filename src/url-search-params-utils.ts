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
 * adapter's `serializeSearch`.
 *
 *   import { keepSubDelims } from "@xtandard/lib/web";
 *   <NuqsAdapter serializeSearch={keepSubDelims}>…</NuqsAdapter>
 */
export function keepSubDelims(params: URLSearchParams): string {
  let search = params.toString();
  for (const [encoded, raw] of SUBDELIM_REPLACEMENTS) {
    search = search.replaceAll(encoded, raw);
  }

  return search;
}
