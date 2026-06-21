/**
 * Ready-made **Effect Schema** schemas that validate an untrusted request into
 * the `@xtandard/lib/filters` model types — the Effect counterpart of the valibot
 * `./schemas`. Optional, exposed at `@xtandard/lib/filters/effect` (peer `effect`
 * + `@js-temporal/polyfill`). A `*.test-d.ts` asserts each schema's
 * `Schema.Schema.Type` output **equals** the model type, so this can't drift.
 *
 * The operator vocab comes from the core's exported `*_OPERATORS` constants
 * (spread into `Schema.Literal`, which preserves the literal union). Effect
 * models data as `readonly` by default; the model types are mutable, so structs
 * and arrays go through the `struct`/`arr` helpers (`Schema.mutable`) to match
 * exactly. `Schema.mutable` is a type-level transform — runtime decoding is
 * unchanged.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { FiltersRequestSchema } from "@xtandard/lib/filters/effect";
 *
 * const filters = Schema.decodeUnknownSync(FiltersRequestSchema)(await req.json());
 * ```
 */

import { Schema } from "effect";

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

const lit = <const A extends readonly string[]>(xs: A) => Schema.Literal(...xs);
// Effect is readonly-by-default; the model types are mutable — flip both.
const struct = <F extends Schema.Struct.Fields>(fields: F) => Schema.mutable(Schema.Struct(fields));
const arr = <S extends Schema.Schema.Any>(element: S) => Schema.mutable(Schema.Array(element));

const TimeZone = Schema.String.pipe(
  Schema.filter(isIanaTimeZone, { message: () => "Invalid IANA time zone" }),
);
const PlainDateTime = Schema.String.pipe(
  Schema.filter(isPlainDateTimeString, {
    message: () => "Invalid plain date-time (YYYY-MM-DDTHH:MM[:SS])",
  }),
);

export const TextFilterSchema = Schema.Union(
  struct({
    kind: Schema.Literal("text"),
    operator: lit(TEXT_SCALAR_OPERATORS),
    value: Schema.String,
  }),
  struct({
    kind: Schema.Literal("text"),
    operator: lit(SET_OPERATORS),
    values: arr(Schema.String),
  }),
  struct({ kind: Schema.Literal("text"), operator: lit(UNARY_OPERATORS) }),
);

export const NumberFilterSchema = Schema.Union(
  struct({
    kind: Schema.Literal("number"),
    operator: lit(NUMBER_SCALAR_OPERATORS),
    value: Schema.Number,
  }),
  struct({
    kind: Schema.Literal("number"),
    operator: lit(RANGE_OPERATORS),
    from: Schema.Number,
    to: Schema.Number,
  }),
  struct({
    kind: Schema.Literal("number"),
    operator: lit(SET_OPERATORS),
    values: arr(Schema.Number),
  }),
  struct({ kind: Schema.Literal("number"), operator: lit(UNARY_OPERATORS) }),
);

export const EnumFilterSchema = Schema.Union(
  struct({ kind: Schema.Literal("enum"), operator: lit(EQUALITY_OPERATORS), value: Schema.String }),
  struct({
    kind: Schema.Literal("enum"),
    operator: lit(SET_OPERATORS),
    values: arr(Schema.String),
  }),
  struct({ kind: Schema.Literal("enum"), operator: lit(UNARY_OPERATORS) }),
);

export const BooleanFilterSchema = Schema.Union(
  struct({
    kind: Schema.Literal("boolean"),
    operator: lit(EQUALITY_OPERATORS),
    value: Schema.Boolean,
  }),
  struct({ kind: Schema.Literal("boolean"), operator: lit(UNARY_OPERATORS) }),
);

export const DatePresetSchema = struct({
  kind: Schema.Literal("date"),
  operator: lit(DATE_PRESET_OPERATORS),
  unit: lit(DATE_UNITS),
  timeZone: TimeZone,
  anchor: PlainDateTime,
  end: Schema.optional(PlainDateTime),
  weekStartsOn: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 6))),
});

export const DateFilterSchema = Schema.Union(
  DatePresetSchema,
  struct({ kind: Schema.Literal("date"), operator: lit(UNARY_OPERATORS) }),
);

export const ArrayFilterSchema = Schema.Union(
  struct({
    kind: Schema.Literal("array"),
    operator: lit(ARRAY_COL_OPERATORS),
    values: arr(Schema.Union(Schema.String, Schema.Number)),
  }),
  struct({ kind: Schema.Literal("array"), operator: lit(UNARY_OPERATORS) }),
);

export const FieldFilterSchema = Schema.Union(
  TextFilterSchema,
  NumberFilterSchema,
  EnumFilterSchema,
  BooleanFilterSchema,
  DateFilterSchema,
  ArrayFilterSchema,
);

export const ColumnFilterSchema = struct({ field: Schema.String, filter: FieldFilterSchema });

/** Flat AND-combined list of column filters (the common case). */
export const FiltersRequestSchema = arr(ColumnFilterSchema);

export const SortItemSchema = struct({ field: Schema.String, dir: Schema.Literal("asc", "desc") });

/** A `{ field, dir }[]` sort list. */
export const SortSchema = arr(SortItemSchema);

/** Recursive and/or/not tree (annotated for recursion via `Schema.suspend`). */
export const FilterNodeSchema: Schema.Schema<FilterNode> = Schema.Union(
  struct({ type: Schema.Literal("column"), field: Schema.String, filter: FieldFilterSchema }),
  struct({ type: Schema.Literal("and"), nodes: arr(Schema.suspend(() => FilterNodeSchema)) }),
  struct({ type: Schema.Literal("or"), nodes: arr(Schema.suspend(() => FilterNodeSchema)) }),
  struct({ type: Schema.Literal("not"), node: Schema.suspend(() => FilterNodeSchema) }),
);
