import type { Sort } from "./types.ts";

/**
 * Sort helpers (pure, no validation library). The `Sort` model lives in
 * `./types.ts`; the valibot schema is in `@xtandard/lib/filters/valibot`. Field
 * names are public — the per-adapter column allow-list maps them to columns, so
 * a client can never sort by a column that isn't declared sortable.
 *
 * Parse a compact `sort` query param: `"createdAt:desc,name:asc"`. Empty/absent
 * input → `[]`. Parsing is lenient (the allow-list is the real guard): an entry
 * with an empty field is skipped, and any direction other than exactly `asc`
 * (missing, `ASC`, a typo) becomes `desc`. Unknown field names are kept here
 * and dropped later by the adapter's column allow-list.
 *
 * @example
 * ```ts
 * import { parseSortParam } from "@xtandard/lib/filters";
 *
 * parseSortParam({ value: "createdAt:desc,name:asc" });
 * // → { sort: [{ field: "createdAt", dir: "desc" }, { field: "name", dir: "asc" }] }
 *
 * parseSortParam({ value: "name,price:ASC,:asc" });
 * // → { sort: [{ field: "name", dir: "desc" }, { field: "price", dir: "desc" }] }
 *
 * parseSortParam({ value: null }); // → { sort: [] }
 * ```
 */
export function parseSortParam(input: { value: string | null | undefined }): { sort: Sort } {
  if (!input.value) return { sort: [] };

  const sort: Sort = [];

  for (const part of input.value.split(",")) {
    const [field, rawDir] = part.split(":");
    if (!field) continue;

    sort.push({ field: field.trim(), dir: rawDir?.trim() === "asc" ? "asc" : "desc" });
  }

  return { sort };
}

/**
 * Serialize the model back to the compact query form (`field:dir`, comma
 * separated) — the inverse of {@link parseSortParam}.
 *
 * @example
 * ```ts
 * import { serializeSort } from "@xtandard/lib/filters";
 *
 * serializeSort({
 *   sort: [
 *     { field: "createdAt", dir: "desc" },
 *     { field: "name", dir: "asc" },
 *   ],
 * }); // → "createdAt:desc,name:asc"
 * serializeSort({ sort: [] }); // → ""
 * ```
 */
export function serializeSort(input: { sort: Sort }): string {
  return input.sort.map((s) => `${s.field}:${s.dir}`).join(",");
}
