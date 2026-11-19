/**
 * Ready-made **Zod** schemas that validate an untrusted request into the
 * `@xtandard/lib/filters` model types — the Zod counterpart of the valibot
 * `./schemas`. Optional, exposed at `@xtandard/lib/filters/zod` (peer `zod` +
 * `@js-temporal/polyfill`). A `*.test-d.ts` asserts each schema's `z.infer`
 * output **equals** the model type, so this can't drift.
 *
 * Zod's `discriminatedUnion` needs a single literal discriminator per member,
 * but each `kind` has several operator shapes — so the leaves are a plain
 * `z.union` (the `kind` literal + the extra field disambiguate at parse time).
 * The operator vocab comes from the core's exported `*_OPERATORS` constants.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { FiltersRequestSchema } from "@xtandard/lib/filters/zod";
 *
 * const filters = FiltersRequestSchema.parse(await req.json());
 * ```
 */

import { z } from "zod";

import type { FilterNode } from "./types.ts";
import { DATE_UNITS, isIanaTimeZone, isPlainDateTimeString } from "./refine.ts";
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

const TimeZone = z.string().refine(isIanaTimeZone, { message: "Invalid IANA time zone" });
const PlainDateTime = z
  .string()
  .refine(isPlainDateTimeString, { message: "Invalid plain date-time (YYYY-MM-DDTHH:MM[:SS])" });

/**
 * Validates a `text`-kind field filter (the model's `TextFilter`): a single
 * `value` with a text operator (`TEXT_SCALAR_OPERATORS`), a `values[]` list with
 * `inArray`/`notInArray`, or a unary `isNull`/`isNotNull`.
 *
 * @example
 * ```ts
 * import { TextFilterSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = { kind: "text", operator: "contains", value: "ada" };
 * TextFilterSchema.parse(input);
 * // → `input`, typed as `TextFilter`
 * TextFilterSchema.safeParse({ kind: "text", operator: "lt", value: "a" }).success;
 * // → false (`lt` isn't a text operator)
 * ```
 */
export const TextFilterSchema = z.union([
  z.object({ kind: z.literal("text"), operator: z.enum(TEXT_SCALAR_OPERATORS), value: z.string() }),
  z.object({
    kind: z.literal("text"),
    operator: z.enum(SET_OPERATORS),
    values: z.array(z.string()),
  }),
  z.object({ kind: z.literal("text"), operator: z.enum(UNARY_OPERATORS) }),
]);

/**
 * Validates a `number`-kind field filter (the model's `NumberFilter`): a
 * comparison `value`, a `from` + `to` range, a `values[]` list, or a unary
 * operator.
 *
 * @example
 * ```ts
 * import { NumberFilterSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = { kind: "number", operator: "between", from: 10, to: 100 };
 * NumberFilterSchema.parse(input);
 * // → `input`, typed as `NumberFilter`
 * NumberFilterSchema.safeParse({ kind: "number", operator: "between", from: 10 }).success;
 * // → false (a range needs `to`)
 * ```
 */
export const NumberFilterSchema = z.union([
  z.object({
    kind: z.literal("number"),
    operator: z.enum(NUMBER_SCALAR_OPERATORS),
    value: z.number(),
  }),
  z.object({
    kind: z.literal("number"),
    operator: z.enum(RANGE_OPERATORS),
    from: z.number(),
    to: z.number(),
  }),
  z.object({
    kind: z.literal("number"),
    operator: z.enum(SET_OPERATORS),
    values: z.array(z.number()),
  }),
  z.object({ kind: z.literal("number"), operator: z.enum(UNARY_OPERATORS) }),
]);

/**
 * Validates an `enum`-kind field filter (the model's `EnumFilter`): `eq`/`ne`
 * with a string `value`, a `values[]` list, or a unary operator. Which enum
 * values are allowed is not checked here.
 *
 * @example
 * ```ts
 * import { EnumFilterSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = { kind: "enum", operator: "inArray", values: ["open", "done"] };
 * EnumFilterSchema.parse(input);
 * // → `input`, typed as `EnumFilter`
 * EnumFilterSchema.safeParse({ kind: "enum", operator: "contains", value: "op" }).success;
 * // → false (no text matching on enums)
 * ```
 */
export const EnumFilterSchema = z.union([
  z.object({ kind: z.literal("enum"), operator: z.enum(EQUALITY_OPERATORS), value: z.string() }),
  z.object({
    kind: z.literal("enum"),
    operator: z.enum(SET_OPERATORS),
    values: z.array(z.string()),
  }),
  z.object({ kind: z.literal("enum"), operator: z.enum(UNARY_OPERATORS) }),
]);

/**
 * Validates a `boolean`-kind field filter (the model's `BooleanFilter`):
 * `eq`/`ne` with a boolean `value`, or a unary operator.
 *
 * @example
 * ```ts
 * import { BooleanFilterSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = { kind: "boolean", operator: "eq", value: true };
 * BooleanFilterSchema.parse(input);
 * // → `input`, typed as `BooleanFilter`
 * BooleanFilterSchema.safeParse({ kind: "boolean", operator: "eq", value: "true" }).success;
 * // → false (a string, not a boolean)
 * ```
 */
export const BooleanFilterSchema = z.union([
  z.object({
    kind: z.literal("boolean"),
    operator: z.enum(EQUALITY_OPERATORS),
    value: z.boolean(),
  }),
  z.object({ kind: z.literal("boolean"), operator: z.enum(UNARY_OPERATORS) }),
]);

/**
 * Validates a `date` period preset (the model's `DatePreset`): `operator`
 * (`is`/`before`/`after`/`between`), `unit`, a real IANA `timeZone`, a
 * `Temporal.PlainDateTime` string `anchor` (and optional `end`), and an optional
 * `weekStartsOn` integer 0–6. The anchor is a wall-clock time read in
 * `timeZone`, not an instant (a `Z`-suffixed string is rejected); a date-only
 * `"2026-02-01"` is accepted as midnight.
 *
 * @example
 * ```ts
 * import { DatePresetSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = {
 *   kind: "date", operator: "is", unit: "month",
 *   timeZone: "America/Los_Angeles", anchor: "2026-02-01T00:00:00",
 * };
 * DatePresetSchema.parse(input);
 * // → `input`, typed as `DatePreset`
 * DatePresetSchema.safeParse({ ...input, timeZone: "Mars/Olympus" }).success;
 * // → false (not an IANA zone)
 * ```
 */
export const DatePresetSchema = z.object({
  kind: z.literal("date"),
  operator: z.enum(DATE_PRESET_OPERATORS),
  unit: z.enum(DATE_UNITS),
  timeZone: TimeZone,
  anchor: PlainDateTime,
  end: PlainDateTime.optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
});

/**
 * Validates a `date`-kind field filter (the model's `DateFilter`): a period
 * preset (see `DatePresetSchema`) or a unary `isNull`/`isNotNull`.
 *
 * @example
 * ```ts
 * import { DateFilterSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = { kind: "date", operator: "isNull" };
 * DateFilterSchema.parse(input);
 * // → `input`, typed as `DateFilter`
 * DateFilterSchema.safeParse({ kind: "date", operator: "eq", value: "2026-02-01" }).success;
 * // → false (dates use presets, not `eq`)
 * ```
 */
export const DateFilterSchema = z.union([
  DatePresetSchema,
  z.object({ kind: z.literal("date"), operator: z.enum(UNARY_OPERATORS) }),
]);

/**
 * Validates an `array`-kind field filter (the model's `ArrayFilter`): an
 * array-column operator (`arrayContains`/`arrayContained`/`arrayOverlaps`) with a
 * `values[]` list of strings/numbers, or a unary operator.
 *
 * @example
 * ```ts
 * import { ArrayFilterSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = { kind: "array", operator: "arrayOverlaps", values: ["a", 1] };
 * ArrayFilterSchema.parse(input);
 * // → `input`, typed as `ArrayFilter`
 * ArrayFilterSchema.safeParse({ kind: "array", operator: "inArray", values: ["a"] }).success;
 * // → false (use the array operators)
 * ```
 */
export const ArrayFilterSchema = z.union([
  z.object({
    kind: z.literal("array"),
    operator: z.enum(ARRAY_COL_OPERATORS),
    values: z.array(z.union([z.string(), z.number()])),
  }),
  z.object({ kind: z.literal("array"), operator: z.enum(UNARY_OPERATORS) }),
]);

/**
 * Validates any field filter (the model's `FieldFilter`): the union of the six
 * per-kind schemas, so the `operator` must be valid for the `kind`.
 *
 * @example
 * ```ts
 * import { FieldFilterSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = { kind: "number", operator: "gte", value: 10 };
 * FieldFilterSchema.parse(input);
 * // → `input`, typed as `FieldFilter`
 * FieldFilterSchema.safeParse({ kind: "number", operator: "contains", value: "1" }).success;
 * // → false (`contains` isn't a number operator)
 * ```
 */
export const FieldFilterSchema = z.union([
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
 * import { ColumnFilterSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = { field: "status", filter: { kind: "enum", operator: "eq", value: "open" } };
 * ColumnFilterSchema.parse(input);
 * // → `input`, typed as `ColumnFilter`
 * const bad = { field: "status", filter: { kind: "enum", operator: "eq" } };
 * ColumnFilterSchema.safeParse(bad).success;
 * // → false (`eq` needs a `value`)
 * ```
 */
export const ColumnFilterSchema = z.object({ field: z.string(), filter: FieldFilterSchema });

/**
 * Flat AND-combined list of column filters (the common case): validates a
 * `FiltersRequest` (`ColumnFilter[]`), e.g. a request body, before it reaches an
 * adapter.
 *
 * @example
 * ```ts
 * import { FiltersRequestSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = [
 *   { field: "name", filter: { kind: "text", operator: "contains", value: "ada" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 10 } },
 * ];
 * FiltersRequestSchema.parse(input);
 * // → `input`, typed as `FiltersRequest`
 * FiltersRequestSchema.safeParse([{ field: "name" }]).success;
 * // → false (missing `filter`)
 * ```
 */
export const FiltersRequestSchema = z.array(ColumnFilterSchema);

/**
 * Validates one sort entry `{ field, dir }` (the model's `SortItem`); `dir` is
 * `"asc"` or `"desc"`.
 *
 * @example
 * ```ts
 * import { SortItemSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = { field: "createdAt", dir: "desc" };
 * SortItemSchema.parse(input);
 * // → `input`, typed as `SortItem`
 * SortItemSchema.safeParse({ field: "createdAt", dir: "down" }).success;
 * // → false (`dir` must be "asc" or "desc")
 * ```
 */
export const SortItemSchema = z.object({ field: z.string(), dir: z.enum(["asc", "desc"]) });

/**
 * A `{ field, dir }[]` sort list (the model's `Sort`), applied in order.
 *
 * @example
 * ```ts
 * import { SortSchema } from "@xtandard/lib/filters/zod";
 *
 * const input = [
 *   { field: "createdAt", dir: "desc" },
 *   { field: "name", dir: "asc" },
 * ];
 * SortSchema.parse(input);
 * // → `input`, typed as `Sort`
 * SortSchema.safeParse([{ field: "name" }]).success;
 * // → false (missing `dir`)
 * ```
 */
export const SortSchema = z.array(SortItemSchema);

/**
 * Recursive and/or/not tree (the model's `FilterNode`), annotated as
 * `z.ZodType<FilterNode>` for recursion without a cast.
 *
 * @example
 * ```ts
 * import { FilterNodeSchema } from "@xtandard/lib/filters/zod";
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
 * FilterNodeSchema.parse(input);
 * // → `input`, typed as `FilterNode`
 * FilterNodeSchema.safeParse({ type: "xor", nodes: [] }).success;
 * // → false (unknown connective)
 * ```
 */
export const FilterNodeSchema: z.ZodType<FilterNode> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("column"), field: z.string(), filter: FieldFilterSchema }),
    z.object({ type: z.literal("and"), nodes: z.array(FilterNodeSchema) }),
    z.object({ type: z.literal("or"), nodes: z.array(FilterNodeSchema) }),
    z.object({ type: z.literal("not"), node: FilterNodeSchema }),
  ]),
);
