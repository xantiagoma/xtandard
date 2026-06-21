import * as v from "valibot";

/**
 * Sort model — a list of `{ field, dir }` applied in order. Field names are
 * public (the resource allow-list maps them to columns, just like filters), so
 * a client can never sort by a column that isn't declared sortable.
 */
export const SortDirectionSchema = v.picklist(["asc", "desc"]);

export const SortItemSchema = v.object({
  field: v.string(),
  dir: SortDirectionSchema,
});

export const SortSchema = v.array(SortItemSchema);

export type SortDirection = v.InferOutput<typeof SortDirectionSchema>;
export type SortItem = v.InferOutput<typeof SortItemSchema>;
export type Sort = v.InferOutput<typeof SortSchema>;

/**
 * Parse a compact `sort` query param into the model: `"createdAt:desc,name:asc"`.
 * Unknown/malformed entries are dropped (the allow-list in the where-builder is
 * the real guard). Returns `[]` for empty/absent input.
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
