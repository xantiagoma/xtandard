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

/**
 * Validates a `text`-kind field filter (the model's `TextFilter`): a single
 * `value` with a text operator (`TEXT_SCALAR_OPERATORS`), a `values[]` list with
 * `inArray`/`notInArray`, or a unary `isNull`/`isNotNull`.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { TextFilterSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = { kind: "text", operator: "contains", value: "ada" };
 * Schema.decodeUnknownSync(TextFilterSchema)(input);
 * // → `input`, typed as `TextFilter`
 * Schema.is(TextFilterSchema)({ kind: "text", operator: "lt", value: "a" });
 * // → false (`lt` isn't a text operator)
 * ```
 */
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

/**
 * Validates a `number`-kind field filter (the model's `NumberFilter`): a
 * comparison `value`, a `from` + `to` range, a `values[]` list, or a unary
 * operator.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { NumberFilterSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = { kind: "number", operator: "between", from: 10, to: 100 };
 * Schema.decodeUnknownSync(NumberFilterSchema)(input);
 * // → `input`, typed as `NumberFilter`
 * Schema.is(NumberFilterSchema)({ kind: "number", operator: "between", from: 10 });
 * // → false (a range needs `to`)
 * ```
 */
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

/**
 * Validates an `enum`-kind field filter (the model's `EnumFilter`): `eq`/`ne`
 * with a string `value`, a `values[]` list, or a unary operator. Which enum
 * values are allowed is not checked here.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { EnumFilterSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = { kind: "enum", operator: "inArray", values: ["open", "done"] };
 * Schema.decodeUnknownSync(EnumFilterSchema)(input);
 * // → `input`, typed as `EnumFilter`
 * Schema.is(EnumFilterSchema)({ kind: "enum", operator: "contains", value: "op" });
 * // → false (no text matching on enums)
 * ```
 */
export const EnumFilterSchema = Schema.Union(
  struct({ kind: Schema.Literal("enum"), operator: lit(EQUALITY_OPERATORS), value: Schema.String }),
  struct({
    kind: Schema.Literal("enum"),
    operator: lit(SET_OPERATORS),
    values: arr(Schema.String),
  }),
  struct({ kind: Schema.Literal("enum"), operator: lit(UNARY_OPERATORS) }),
);

/**
 * Validates a `boolean`-kind field filter (the model's `BooleanFilter`):
 * `eq`/`ne` with a boolean `value`, or a unary operator.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { BooleanFilterSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = { kind: "boolean", operator: "eq", value: true };
 * Schema.decodeUnknownSync(BooleanFilterSchema)(input);
 * // → `input`, typed as `BooleanFilter`
 * Schema.is(BooleanFilterSchema)({ kind: "boolean", operator: "eq", value: "true" });
 * // → false (a string, not a boolean)
 * ```
 */
export const BooleanFilterSchema = Schema.Union(
  struct({
    kind: Schema.Literal("boolean"),
    operator: lit(EQUALITY_OPERATORS),
    value: Schema.Boolean,
  }),
  struct({ kind: Schema.Literal("boolean"), operator: lit(UNARY_OPERATORS) }),
);

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
 * import { Schema } from "effect";
 * import { DatePresetSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = {
 *   kind: "date", operator: "is", unit: "month",
 *   timeZone: "America/Los_Angeles", anchor: "2026-02-01T00:00:00",
 * };
 * Schema.decodeUnknownSync(DatePresetSchema)(input);
 * // → `input`, typed as `DatePreset`
 * Schema.is(DatePresetSchema)({ ...input, timeZone: "Mars/Olympus" });
 * // → false (not an IANA zone)
 * ```
 */
export const DatePresetSchema = struct({
  kind: Schema.Literal("date"),
  operator: lit(DATE_PRESET_OPERATORS),
  unit: lit(DATE_UNITS),
  timeZone: TimeZone,
  anchor: PlainDateTime,
  end: Schema.optional(PlainDateTime),
  weekStartsOn: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 6))),
});

/**
 * Validates a `date`-kind field filter (the model's `DateFilter`): a period
 * preset (see `DatePresetSchema`) or a unary `isNull`/`isNotNull`.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { DateFilterSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = { kind: "date", operator: "isNull" };
 * Schema.decodeUnknownSync(DateFilterSchema)(input);
 * // → `input`, typed as `DateFilter`
 * Schema.is(DateFilterSchema)({ kind: "date", operator: "eq", value: "2026-02-01" });
 * // → false (dates use presets, not `eq`)
 * ```
 */
export const DateFilterSchema = Schema.Union(
  DatePresetSchema,
  struct({ kind: Schema.Literal("date"), operator: lit(UNARY_OPERATORS) }),
);

/**
 * Validates an `array`-kind field filter (the model's `ArrayFilter`): an
 * array-column operator (`arrayContains`/`arrayContained`/`arrayOverlaps`) with a
 * `values[]` list of strings/numbers, or a unary operator.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { ArrayFilterSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = { kind: "array", operator: "arrayOverlaps", values: ["a", 1] };
 * Schema.decodeUnknownSync(ArrayFilterSchema)(input);
 * // → `input`, typed as `ArrayFilter`
 * Schema.is(ArrayFilterSchema)({ kind: "array", operator: "inArray", values: ["a"] });
 * // → false (use the array operators)
 * ```
 */
export const ArrayFilterSchema = Schema.Union(
  struct({
    kind: Schema.Literal("array"),
    operator: lit(ARRAY_COL_OPERATORS),
    values: arr(Schema.Union(Schema.String, Schema.Number)),
  }),
  struct({ kind: Schema.Literal("array"), operator: lit(UNARY_OPERATORS) }),
);

/**
 * Validates any field filter (the model's `FieldFilter`): the union of the six
 * per-kind schemas, so the `operator` must be valid for the `kind`.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { FieldFilterSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = { kind: "number", operator: "gte", value: 10 };
 * Schema.decodeUnknownSync(FieldFilterSchema)(input);
 * // → `input`, typed as `FieldFilter`
 * Schema.is(FieldFilterSchema)({ kind: "number", operator: "contains", value: "1" });
 * // → false (`contains` isn't a number operator)
 * ```
 */
export const FieldFilterSchema = Schema.Union(
  TextFilterSchema,
  NumberFilterSchema,
  EnumFilterSchema,
  BooleanFilterSchema,
  DateFilterSchema,
  ArrayFilterSchema,
);

/**
 * Validates one `ColumnFilter`: a public `field` name plus its `filter`. The
 * field name is not checked against an allow-list here; the adapters' `spec`
 * does that.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { ColumnFilterSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = { field: "status", filter: { kind: "enum", operator: "eq", value: "open" } };
 * Schema.decodeUnknownSync(ColumnFilterSchema)(input);
 * // → `input`, typed as `ColumnFilter`
 * Schema.is(ColumnFilterSchema)({ field: "status", filter: { kind: "enum", operator: "eq" } });
 * // → false (`eq` needs a `value`)
 * ```
 */
export const ColumnFilterSchema = struct({ field: Schema.String, filter: FieldFilterSchema });

/**
 * Flat AND-combined list of column filters (the common case): validates a
 * `FiltersRequest` (`ColumnFilter[]`), e.g. a request body, before it reaches an
 * adapter.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { FiltersRequestSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = [
 *   { field: "name", filter: { kind: "text", operator: "contains", value: "ada" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 10 } },
 * ];
 * Schema.decodeUnknownSync(FiltersRequestSchema)(input);
 * // → `input`, typed as `FiltersRequest`
 * Schema.is(FiltersRequestSchema)([{ field: "name" }]);
 * // → false (missing `filter`)
 * ```
 */
export const FiltersRequestSchema = arr(ColumnFilterSchema);

/**
 * Validates one sort entry `{ field, dir }` (the model's `SortItem`); `dir` is
 * `"asc"` or `"desc"`.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { SortItemSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = { field: "createdAt", dir: "desc" };
 * Schema.decodeUnknownSync(SortItemSchema)(input);
 * // → `input`, typed as `SortItem`
 * Schema.is(SortItemSchema)({ field: "createdAt", dir: "down" });
 * // → false (`dir` must be "asc" or "desc")
 * ```
 */
export const SortItemSchema = struct({ field: Schema.String, dir: Schema.Literal("asc", "desc") });

/**
 * A `{ field, dir }[]` sort list (the model's `Sort`), applied in order.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { SortSchema } from "@xtandard/lib/filters/effect";
 *
 * const input = [
 *   { field: "createdAt", dir: "desc" },
 *   { field: "name", dir: "asc" },
 * ];
 * Schema.decodeUnknownSync(SortSchema)(input);
 * // → `input`, typed as `Sort`
 * Schema.is(SortSchema)([{ field: "name" }]);
 * // → false (missing `dir`)
 * ```
 */
export const SortSchema = arr(SortItemSchema);

/**
 * Recursive and/or/not tree (the model's `FilterNode`), annotated for recursion
 * via `Schema.suspend`.
 *
 * @example
 * ```ts
 * import { Schema } from "effect";
 * import { FilterNodeSchema } from "@xtandard/lib/filters/effect";
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
 * Schema.decodeUnknownSync(FilterNodeSchema)(input);
 * // → `input`, typed as `FilterNode`
 * Schema.is(FilterNodeSchema)({ type: "xor", nodes: [] });
 * // → false (unknown connective)
 * ```
 */
export const FilterNodeSchema: Schema.Schema<FilterNode> = Schema.Union(
  struct({ type: Schema.Literal("column"), field: Schema.String, filter: FieldFilterSchema }),
  struct({ type: Schema.Literal("and"), nodes: arr(Schema.suspend(() => FilterNodeSchema)) }),
  struct({ type: Schema.Literal("or"), nodes: arr(Schema.suspend(() => FilterNodeSchema)) }),
  struct({ type: Schema.Literal("not"), node: Schema.suspend(() => FilterNodeSchema) }),
);
