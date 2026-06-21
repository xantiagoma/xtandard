import * as v from "valibot";

import { isValidTimeZone } from "../valibot-utils.ts";
import { PlainDateTimeSchema } from "../temporal-schemas.ts";
import {
  ARRAY_COL_OPERATORS,
  DATE_PRESET_OPERATORS,
  EQUALITY_OPERATORS,
  NUMBER_SCALAR_OPERATORS,
  RANGE_OPERATORS,
  SET_OPERATORS,
  TEXT_SCALAR_OPERATORS,
  UNARY_OPERATORS,
} from "./operators.ts";

/**
 * The shared filter model — valibot schemas are the source of truth; TS types
 * are derived with `v.InferOutput` so `v.parse` yields the discriminated union
 * with NO cast. Two levels of `v.variant`: the outer on `kind` (the column data
 * kind), the inner on `operator` (the argument-shape group within a kind). The
 * operator vocabulary is Drizzle-aligned (see ./operators).
 *
 * FRONTEND-SAFE — no drizzle. The Drizzle WHERE builder lives in the
 * `xantiagoma/filters/drizzle` subpath.
 */

// Plain-string IANA timezone (validated, NOT branded) — keeps InferInput ===
// InferOutput === string, which the recursive FilterNode annotation requires.
const TimeZoneStringSchema = v.pipe(
  v.string(),
  v.check((tz) => isValidTimeZone({ timeZone: tz }).valid, "Invalid IANA timezone"),
);

const DATE_UNITS = [
  "millisecond",
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "halfYear",
  "year",
] as const;

// ── text ── string columns
const TextScalar = v.object({
  kind: v.literal("text"),
  operator: v.picklist(TEXT_SCALAR_OPERATORS),
  value: v.string(),
});
const TextSet = v.object({
  kind: v.literal("text"),
  operator: v.picklist(SET_OPERATORS),
  values: v.array(v.string()),
});
const TextUnary = v.object({ kind: v.literal("text"), operator: v.picklist(UNARY_OPERATORS) });
export const TextFilterSchema = v.variant("operator", [TextScalar, TextSet, TextUnary]);

// ── number ── numeric columns
const NumberScalar = v.object({
  kind: v.literal("number"),
  operator: v.picklist(NUMBER_SCALAR_OPERATORS),
  value: v.number(),
});
const NumberRange = v.object({
  kind: v.literal("number"),
  operator: v.picklist(RANGE_OPERATORS),
  from: v.number(),
  to: v.number(),
});
const NumberSet = v.object({
  kind: v.literal("number"),
  operator: v.picklist(SET_OPERATORS),
  values: v.array(v.number()),
});
const NumberUnary = v.object({ kind: v.literal("number"), operator: v.picklist(UNARY_OPERATORS) });
export const NumberFilterSchema = v.variant("operator", [
  NumberScalar,
  NumberRange,
  NumberSet,
  NumberUnary,
]);

// ── enum ── text columns with a fixed value set
const EnumEquality = v.object({
  kind: v.literal("enum"),
  operator: v.picklist(EQUALITY_OPERATORS),
  value: v.string(),
});
const EnumSet = v.object({
  kind: v.literal("enum"),
  operator: v.picklist(SET_OPERATORS),
  values: v.array(v.string()),
});
const EnumUnary = v.object({ kind: v.literal("enum"), operator: v.picklist(UNARY_OPERATORS) });
export const EnumFilterSchema = v.variant("operator", [EnumEquality, EnumSet, EnumUnary]);

// ── boolean ──
const BooleanEquality = v.object({
  kind: v.literal("boolean"),
  operator: v.picklist(EQUALITY_OPERATORS),
  value: v.boolean(),
});
const BooleanUnary = v.object({
  kind: v.literal("boolean"),
  operator: v.picklist(UNARY_OPERATORS),
});
export const BooleanFilterSchema = v.variant("operator", [BooleanEquality, BooleanUnary]);

// ── date ── the DST-correct period preset (is/before/after/between over a unit)
// resolves to a half-open instant interval; plus the null checks.
export const DatePresetSchema = v.object({
  kind: v.literal("date"),
  operator: v.picklist(DATE_PRESET_OPERATORS),
  unit: v.picklist(DATE_UNITS),
  timeZone: TimeZoneStringSchema,
  anchor: PlainDateTimeSchema,
  end: v.optional(PlainDateTimeSchema),
  weekStartsOn: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(6))),
});
const DateUnary = v.object({ kind: v.literal("date"), operator: v.picklist(UNARY_OPERATORS) });
export const DateFilterSchema = v.variant("operator", [DatePresetSchema, DateUnary]);

// ── array ── PostgreSQL array columns
const ArrayElement = v.union([v.string(), v.number()]);
const ArrayOps = v.object({
  kind: v.literal("array"),
  operator: v.picklist(ARRAY_COL_OPERATORS),
  values: v.array(ArrayElement),
});
const ArrayUnary = v.object({ kind: v.literal("array"), operator: v.picklist(UNARY_OPERATORS) });
export const ArrayFilterSchema = v.variant("operator", [ArrayOps, ArrayUnary]);

export const FieldFilterSchema = v.variant("kind", [
  TextFilterSchema,
  NumberFilterSchema,
  EnumFilterSchema,
  BooleanFilterSchema,
  DateFilterSchema,
  ArrayFilterSchema,
]);

export const ColumnFilterSchema = v.object({
  field: v.string(),
  filter: FieldFilterSchema,
});

/** A request as a flat AND-combined list of column filters (the common case;
 * the FilterBar emits this). For nested AND/OR/NOT use `FilterNodeSchema`. */
export const FiltersRequestSchema = v.array(ColumnFilterSchema);

export type DatePreset = v.InferOutput<typeof DatePresetSchema>;
export type TextFilter = v.InferOutput<typeof TextFilterSchema>;
export type NumberFilter = v.InferOutput<typeof NumberFilterSchema>;
export type EnumFilter = v.InferOutput<typeof EnumFilterSchema>;
export type BooleanFilter = v.InferOutput<typeof BooleanFilterSchema>;
export type DateFilter = v.InferOutput<typeof DateFilterSchema>;
export type ArrayFilter = v.InferOutput<typeof ArrayFilterSchema>;
export type FieldFilter = v.InferOutput<typeof FieldFilterSchema>;
export type ColumnFilter = v.InferOutput<typeof ColumnFilterSchema>;
export type FiltersRequest = v.InferOutput<typeof FiltersRequestSchema>;
export type FieldKind = FieldFilter["kind"];

/**
 * A recursive filter tree: leaves are column filters, internal nodes combine
 * them with and / or / not. Defined as an explicit type + a `v.lazy` schema
 * annotated with `GenericSchema<FilterNode>` (recursion without a cast).
 */
export type FilterNode =
  | { type: "column"; field: string; filter: FieldFilter }
  | { type: "and"; nodes: FilterNode[] }
  | { type: "or"; nodes: FilterNode[] }
  | { type: "not"; node: FilterNode };

export const FilterNodeSchema: v.GenericSchema<FilterNode> = v.lazy(() =>
  v.variant("type", [
    v.object({ type: v.literal("column"), field: v.string(), filter: FieldFilterSchema }),
    v.object({ type: v.literal("and"), nodes: v.array(FilterNodeSchema) }),
    v.object({ type: v.literal("or"), nodes: v.array(FilterNodeSchema) }),
    v.object({ type: v.literal("not"), node: FilterNodeSchema }),
  ]),
);
