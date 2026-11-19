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

/**
 * Validates a `text`-kind field filter (the model's `TextFilter`): a single
 * `value` with a text operator (`TEXT_SCALAR_OPERATORS`), a `values[]` list with
 * `inArray`/`notInArray`, or a unary `isNull`/`isNotNull`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { TextFilterSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = { kind: "text", operator: "contains", value: "ada" };
 * v.parse(TextFilterSchema, input);
 * // → `input`, typed as `TextFilter`
 * v.is(TextFilterSchema, { kind: "text", operator: "lt", value: "a" });
 * // → false (`lt` isn't a text operator)
 * ```
 */
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

/**
 * Validates a `number`-kind field filter (the model's `NumberFilter`): a
 * comparison `value`, a `from` + `to` range, a `values[]` list, or a unary
 * operator.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { NumberFilterSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = { kind: "number", operator: "between", from: 10, to: 100 };
 * v.parse(NumberFilterSchema, input);
 * // → `input`, typed as `NumberFilter`
 * v.is(NumberFilterSchema, { kind: "number", operator: "between", from: 10 });
 * // → false (a range needs `to`)
 * ```
 */
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

/**
 * Validates an `enum`-kind field filter (the model's `EnumFilter`): `eq`/`ne`
 * with a string `value`, a `values[]` list, or a unary operator. Which enum
 * values are allowed is not checked here.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { EnumFilterSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = { kind: "enum", operator: "inArray", values: ["open", "done"] };
 * v.parse(EnumFilterSchema, input);
 * // → `input`, typed as `EnumFilter`
 * v.is(EnumFilterSchema, { kind: "enum", operator: "contains", value: "op" });
 * // → false (no text matching on enums)
 * ```
 */
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

/**
 * Validates a `boolean`-kind field filter (the model's `BooleanFilter`):
 * `eq`/`ne` with a boolean `value`, or a unary operator.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { BooleanFilterSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = { kind: "boolean", operator: "eq", value: true };
 * v.parse(BooleanFilterSchema, input);
 * // → `input`, typed as `BooleanFilter`
 * v.is(BooleanFilterSchema, { kind: "boolean", operator: "eq", value: "true" });
 * // → false (a string, not a boolean)
 * ```
 */
export const BooleanFilterSchema = v.variant("operator", [BooleanEquality, BooleanUnary]);

/**
 * Validates a `date` period preset (the model's `DatePreset`): `operator`
 * (`is`/`before`/`after`/`between`), `unit`, a real IANA `timeZone`, a
 * `Temporal.PlainDateTime` string `anchor` (and optional `end`), and an optional
 * `weekStartsOn` integer 0–6. The anchor is a wall-clock time read in
 * `timeZone`, not an instant (a `Z`-suffixed string is rejected); a date-only
 * `"2026-02-01"` is accepted as midnight and normalized to
 * `"2026-02-01T00:00:00"`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { DatePresetSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = {
 *   kind: "date", operator: "is", unit: "month",
 *   timeZone: "America/Los_Angeles", anchor: "2026-02-01T00:00:00",
 * };
 * v.parse(DatePresetSchema, input);
 * // → `input`, typed as `DatePreset`
 * v.is(DatePresetSchema, { ...input, timeZone: "Mars/Olympus" });
 * // → false (not an IANA zone)
 * ```
 */
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

/**
 * Validates a `date`-kind field filter (the model's `DateFilter`): a period
 * preset (see `DatePresetSchema`) or a unary `isNull`/`isNotNull`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { DateFilterSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = { kind: "date", operator: "isNull" };
 * v.parse(DateFilterSchema, input);
 * // → `input`, typed as `DateFilter`
 * v.is(DateFilterSchema, { kind: "date", operator: "eq", value: "2026-02-01" });
 * // → false (dates use presets, not `eq`)
 * ```
 */
export const DateFilterSchema = v.variant("operator", [DatePresetSchema, DateUnary]);

const ArrayElement = v.union([v.string(), v.number()]);
const ArrayOps = v.object({
  kind: v.literal("array"),
  operator: v.picklist(ARRAY_COL_OPERATORS),
  values: v.array(ArrayElement),
});
const ArrayUnary = v.object({ kind: v.literal("array"), operator: v.picklist(UNARY_OPERATORS) });

/**
 * Validates an `array`-kind field filter (the model's `ArrayFilter`): an
 * array-column operator (`arrayContains`/`arrayContained`/`arrayOverlaps`) with a
 * `values[]` list of strings/numbers, or a unary operator.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { ArrayFilterSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = { kind: "array", operator: "arrayOverlaps", values: ["a", 1] };
 * v.parse(ArrayFilterSchema, input);
 * // → `input`, typed as `ArrayFilter`
 * v.is(ArrayFilterSchema, { kind: "array", operator: "inArray", values: ["a"] });
 * // → false (use the array operators)
 * ```
 */
export const ArrayFilterSchema = v.variant("operator", [ArrayOps, ArrayUnary]);

/**
 * Validates any field filter (the model's `FieldFilter`): the union of the six
 * per-kind schemas, so the `operator` must be valid for the `kind`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { FieldFilterSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = { kind: "number", operator: "gte", value: 10 };
 * v.parse(FieldFilterSchema, input);
 * // → `input`, typed as `FieldFilter`
 * v.is(FieldFilterSchema, { kind: "number", operator: "contains", value: "1" });
 * // → false (`contains` isn't a number operator)
 * ```
 */
export const FieldFilterSchema = v.variant("kind", [
  TextFilterSchema,
  NumberFilterSchema,
  EnumFilterSchema,
  BooleanFilterSchema,
  DateFilterSchema,
  ArrayFilterSchema,
]);

/**
 * Validates one `ColumnFilter`: a public `field` name plus its `filter`. The
 * field name is not checked against an allow-list here; the adapters' `spec`
 * does that.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { ColumnFilterSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = { field: "status", filter: { kind: "enum", operator: "eq", value: "open" } };
 * v.parse(ColumnFilterSchema, input);
 * // → `input`, typed as `ColumnFilter`
 * v.is(ColumnFilterSchema, { field: "status", filter: { kind: "enum", operator: "eq" } });
 * // → false (`eq` needs a `value`)
 * ```
 */
export const ColumnFilterSchema = v.object({
  field: v.string(),
  filter: FieldFilterSchema,
});

/**
 * Flat AND-combined list of column filters (the common case): validates a
 * `FiltersRequest` (`ColumnFilter[]`), e.g. a request body, before it reaches an
 * adapter.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { FiltersRequestSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = [
 *   { field: "name", filter: { kind: "text", operator: "contains", value: "ada" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 10 } },
 * ];
 * v.parse(FiltersRequestSchema, input);
 * // → `input`, typed as `FiltersRequest`
 * v.is(FiltersRequestSchema, [{ field: "name" }]);
 * // → false (missing `filter`)
 * ```
 */
export const FiltersRequestSchema = v.array(ColumnFilterSchema);

/**
 * Validates one sort entry `{ field, dir }` (the model's `SortItem`); `dir` is
 * `"asc"` or `"desc"`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { SortItemSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = { field: "createdAt", dir: "desc" };
 * v.parse(SortItemSchema, input);
 * // → `input`, typed as `SortItem`
 * v.is(SortItemSchema, { field: "createdAt", dir: "down" });
 * // → false (`dir` must be "asc" or "desc")
 * ```
 */
export const SortItemSchema = v.object({
  field: v.string(),
  dir: v.picklist(["asc", "desc"]),
});

/**
 * A `{ field, dir }[]` sort list (the model's `Sort`), applied in order.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { SortSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = [
 *   { field: "createdAt", dir: "desc" },
 *   { field: "name", dir: "asc" },
 * ];
 * v.parse(SortSchema, input);
 * // → `input`, typed as `Sort`
 * v.is(SortSchema, [{ field: "name" }]);
 * // → false (missing `dir`)
 * ```
 */
export const SortSchema = v.array(SortItemSchema);

/**
 * Recursive and/or/not tree (the model's `FilterNode`), annotated as
 * `v.GenericSchema<FilterNode>` for recursion without a cast.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { FilterNodeSchema } from "@xtandard/lib/filters/valibot";
 *
 * const input = {
 *   type: "or",
 *   nodes: [
 *     { type: "column", field: "status", filter: { kind: "enum", operator: "eq", value: "open" } },
 *     {
 *       type: "not",
 *       node: { type: "column", field: "name", filter: { kind: "text", operator: "isNull" } },
 *     },
 *   ],
 * };
 * v.parse(FilterNodeSchema, input);
 * // → `input`, typed as `FilterNode`
 * v.is(FilterNodeSchema, { type: "xor", nodes: [] });
 * // → false (unknown connective)
 * ```
 */
export const FilterNodeSchema: v.GenericSchema<FilterNode> = v.lazy(() =>
  v.variant("type", [
    v.object({ type: v.literal("column"), field: v.string(), filter: FieldFilterSchema }),
    v.object({ type: v.literal("and"), nodes: v.array(FilterNodeSchema) }),
    v.object({ type: v.literal("or"), nodes: v.array(FilterNodeSchema) }),
    v.object({ type: v.literal("not"), node: FilterNodeSchema }),
  ]),
);
