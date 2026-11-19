import type { FieldKind, Sort } from "./types.ts";

import {
  ARRAY_OPERATORS,
  BOOLEAN_OPERATORS,
  DATE_OPERATORS,
  ENUM_OPERATORS,
  NUMBER_OPERATORS,
  TEXT_OPERATORS,
} from "./operators.ts";

/**
 * A wire contract a backend can expose at `…/_metadata` and a FRONTEND can
 * render from — no field defs hand-written on the client. The backend resource
 * definition is the single source of truth; this is its serializable projection
 * (FE-safe, no drizzle).
 */

export type PaginationStyle = "offset" | "cursor";

export interface FieldOption {
  value: string;
  label: string;
  /** Secondary line (e.g. an email under a name). */
  description?: string;
  /** Avatar/image URL for rich option rendering. */
  image?: string;
}

export interface FieldMetadata {
  /** Public field name (maps to a column in the backend allow-list). */
  field: string;
  label: string;
  kind: FieldKind;
  filterable: boolean;
  sortable: boolean;
  /** Operators valid for this field's kind (drizzle-aligned). */
  operators: string[];
  /** Inline options (enum). */
  options?: FieldOption[];
  /** Endpoint to fetch options from (relations) — `…/options?field=<field>`. */
  optionsUrl?: string;
}

export interface ResourceCrud {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface ResourceMetadata {
  name: string;
  fields: FieldMetadata[];
  defaultSort: Sort;
  pagination: { styles: PaginationStyle[] };
  crud: ResourceCrud;
}

/**
 * The operator vocabulary a field of each kind supports (for UI operator
 * pickers and `FieldMetadata.operators`). Each entry is the matching
 * `*_OPERATORS` constant (`text` → `TEXT_OPERATORS`, …).
 *
 * @example Fill a field's operators and build a picker
 * ```ts
 * import { OPERATORS_BY_KIND, type FieldKind } from "@xtandard/lib/filters";
 *
 * OPERATORS_BY_KIND.boolean; // → ["eq", "ne", "isNull", "isNotNull"]
 *
 * const pickerOptions = (kind: FieldKind) =>
 *   OPERATORS_BY_KIND[kind].map((op) => ({ value: op, label: op }));
 * pickerOptions("number").slice(0, 2);
 * // → [{ value: "eq", label: "eq" }, { value: "ne", label: "ne" }]
 * ```
 */
export const OPERATORS_BY_KIND: Record<FieldKind, readonly string[]> = {
  text: TEXT_OPERATORS,
  number: NUMBER_OPERATORS,
  enum: ENUM_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  date: DATE_OPERATORS,
  array: ARRAY_OPERATORS,
};
