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

export const TextFilterSchema = z.union([
  z.object({ kind: z.literal("text"), operator: z.enum(TEXT_SCALAR_OPERATORS), value: z.string() }),
  z.object({
    kind: z.literal("text"),
    operator: z.enum(SET_OPERATORS),
    values: z.array(z.string()),
  }),
  z.object({ kind: z.literal("text"), operator: z.enum(UNARY_OPERATORS) }),
]);

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

export const EnumFilterSchema = z.union([
  z.object({ kind: z.literal("enum"), operator: z.enum(EQUALITY_OPERATORS), value: z.string() }),
  z.object({
    kind: z.literal("enum"),
    operator: z.enum(SET_OPERATORS),
    values: z.array(z.string()),
  }),
  z.object({ kind: z.literal("enum"), operator: z.enum(UNARY_OPERATORS) }),
]);

export const BooleanFilterSchema = z.union([
  z.object({
    kind: z.literal("boolean"),
    operator: z.enum(EQUALITY_OPERATORS),
    value: z.boolean(),
  }),
  z.object({ kind: z.literal("boolean"), operator: z.enum(UNARY_OPERATORS) }),
]);

export const DatePresetSchema = z.object({
  kind: z.literal("date"),
  operator: z.enum(DATE_PRESET_OPERATORS),
  unit: z.enum(DATE_UNITS),
  timeZone: TimeZone,
  anchor: PlainDateTime,
  end: PlainDateTime.optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
});

export const DateFilterSchema = z.union([
  DatePresetSchema,
  z.object({ kind: z.literal("date"), operator: z.enum(UNARY_OPERATORS) }),
]);

export const ArrayFilterSchema = z.union([
  z.object({
    kind: z.literal("array"),
    operator: z.enum(ARRAY_COL_OPERATORS),
    values: z.array(z.union([z.string(), z.number()])),
  }),
  z.object({ kind: z.literal("array"), operator: z.enum(UNARY_OPERATORS) }),
]);

export const FieldFilterSchema = z.union([
  TextFilterSchema,
  NumberFilterSchema,
  EnumFilterSchema,
  BooleanFilterSchema,
  DateFilterSchema,
  ArrayFilterSchema,
]);

export const ColumnFilterSchema = z.object({ field: z.string(), filter: FieldFilterSchema });

/** Flat AND-combined list of column filters (the common case). */
export const FiltersRequestSchema = z.array(ColumnFilterSchema);

export const SortItemSchema = z.object({ field: z.string(), dir: z.enum(["asc", "desc"]) });

/** A `{ field, dir }[]` sort list. */
export const SortSchema = z.array(SortItemSchema);

/** Recursive and/or/not tree (annotated for recursion without a cast). */
export const FilterNodeSchema: z.ZodType<FilterNode> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("column"), field: z.string(), filter: FieldFilterSchema }),
    z.object({ type: z.literal("and"), nodes: z.array(FilterNodeSchema) }),
    z.object({ type: z.literal("or"), nodes: z.array(FilterNodeSchema) }),
    z.object({ type: z.literal("not"), node: FilterNodeSchema }),
  ]),
);
