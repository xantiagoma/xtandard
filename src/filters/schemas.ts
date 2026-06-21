/**
 * Ready-made **valibot** schemas that validate an untrusted request into the
 * `@xtandard/lib/filters` model types. Optional — exposed at
 * `@xtandard/lib/filters/valibot` (peer `valibot` + `@js-temporal/polyfill`). Use
 * any Standard-Schema validator (zod/arktype/effect/…) instead if you prefer;
 * the model is just plain TS types (see `./types.ts`). A `*.test-d.ts` asserts
 * these schemas' output equals the model types.
 *
 * Two levels of `v.variant`: outer on `kind`, inner on `operator`.
 */

import * as v from "valibot";

import type { FilterNode } from "./types.ts";
import { PlainDateTimeSchema } from "../temporal-schemas.ts";
import { isValidTimeZone } from "../valibot-utils.ts";
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

/** Flat AND-combined list of column filters (the common case). */
export const FiltersRequestSchema = v.array(ColumnFilterSchema);

export const SortItemSchema = v.object({
  field: v.string(),
  dir: v.picklist(["asc", "desc"]),
});

/** A `{ field, dir }[]` sort list. */
export const SortSchema = v.array(SortItemSchema);

/** Recursive and/or/not tree (annotated for recursion without a cast). */
export const FilterNodeSchema: v.GenericSchema<FilterNode> = v.lazy(() =>
  v.variant("type", [
    v.object({ type: v.literal("column"), field: v.string(), filter: FieldFilterSchema }),
    v.object({ type: v.literal("and"), nodes: v.array(FilterNodeSchema) }),
    v.object({ type: v.literal("or"), nodes: v.array(FilterNodeSchema) }),
    v.object({ type: v.literal("not"), node: FilterNodeSchema }),
  ]),
);
