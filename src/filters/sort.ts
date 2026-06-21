import type { Sort } from "./types.ts";

/**
 * Sort helpers (pure, no validation library). The `Sort` model lives in
 * `./types.ts`; the valibot schema is in `@xtandard/lib/filters/valibot`. Field
 * names are public — the per-adapter column allow-list maps them to columns, so
 * a client can never sort by a column that isn't declared sortable.
 *
 * Parse a compact `sort` query param: `"createdAt:desc,name:asc"`. Unknown/
 * malformed entries are dropped (the allow-list is the real guard). Empty/absent
 * input → `[]`.
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

/** Serialize the model back to the compact query form. */
export function serializeSort(input: { sort: Sort }): string {
  return input.sort.map((s) => `${s.field}:${s.dir}`).join(",");
}
