import type { Sort, SortDirection } from "./types.ts";

/**
 * Sort helpers (pure, no validation library). The `Sort` model lives in
 * `./types.ts`; the valibot schema is in `@xtandard/lib/filters/valibot`. Field
 * names are public — the per-adapter column allow-list maps them to columns, so
 * a client can never sort by a column that isn't declared sortable.
 *
 * Parse a compact `sort` query param: `"createdAt:desc,name:asc"`. Empty/absent
 * input → `[]`. The direction is `asc` or `desc` in any case (`ASC` works) and
 * defaults to `desc` when missing (`"name"` or `"name:"`). A malformed entry is
 * dropped: an unknown direction (`up`, a typo), a blank field, or extra `:`
 * parts. Unknown field names are kept here and dropped later by the adapter's
 * column allow-list.
 *
 * @example
 * ```ts
 * import { parseSortParam } from "@xtandard/lib/filters";
 *
 * parseSortParam({ value: "createdAt:desc,name:asc" });
 * // → { sort: [{ field: "createdAt", dir: "desc" }, { field: "name", dir: "asc" }] }
 *
 * parseSortParam({ value: "name,price:ASC,:asc,id:up" });
 * // → { sort: [{ field: "name", dir: "desc" }, { field: "price", dir: "asc" }] }
 *
 * parseSortParam({ value: null }); // → { sort: [] }
 * ```
 */
export function parseSortParam(input: { value: string | null | undefined }): { sort: Sort } {
  if (!input.value) return { sort: [] };

  const sort: Sort = [];

  for (const part of input.value.split(",")) {
    const [rawField, rawDir, ...rest] = part.split(":");
    const field = rawField?.trim();
    const dir = parseDirection(rawDir);
    if (!field || !dir || rest.length > 0) continue;

    sort.push({ field, dir });
  }

  return { sort };
}

/** `asc`/`desc` in any case; missing or empty → `desc`; anything else → `null`. */
function parseDirection(raw: string | undefined): SortDirection | null {
  const dir = raw?.trim().toLowerCase() ?? "";
  if (dir === "") return "desc";

  return dir === "asc" || dir === "desc" ? dir : null;
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
