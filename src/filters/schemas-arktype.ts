/**
 * Ready-made **ArkType** schemas that validate an untrusted request into the
 * `@xtandard/lib/filters` model types — the ArkType counterpart of the valibot
 * `./schemas`. Optional, exposed at `@xtandard/lib/filters/arktype` (peer
 * `arktype` + `@js-temporal/polyfill`). A `*.test-d.ts` asserts each schema's
 * `.infer` output **equals** the model type, so this can't drift.
 *
 * Built as one `scope` so the recursive `node` (and/or/not) can reference itself
 * by name; each operator group is an `type.enumerated(...)` over the core's
 * exported `*_OPERATORS` constants, and `timeZone`/`anchor` are narrowed for
 * parity with the valibot schemas (narrowing doesn't change the inferred type).
 *
 * @example
 * ```ts
 * import { FiltersRequestSchema } from "@xtandard/lib/filters/arktype";
 *
 * const filters = FiltersRequestSchema.assert(await req.json()); // throws on invalid
 * ```
 */

import { scope, type } from "arktype";

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

const textScalarOp = type.enumerated(...TEXT_SCALAR_OPERATORS);
const numberScalarOp = type.enumerated(...NUMBER_SCALAR_OPERATORS);
const equalityOp = type.enumerated(...EQUALITY_OPERATORS);
const rangeOp = type.enumerated(...RANGE_OPERATORS);
const setOp = type.enumerated(...SET_OPERATORS);
const arrayOp = type.enumerated(...ARRAY_COL_OPERATORS);
const unaryOp = type.enumerated(...UNARY_OPERATORS);
const datePresetOp = type.enumerated(...DATE_PRESET_OPERATORS);
const unit = type.enumerated(...DATE_UNITS);

const timeZone = type.string.narrow((s) => isIanaTimeZone(s));
const plainDateTime = type.string.narrow((s) => isPlainDateTimeString(s));
const weekStartsOn = type("0 <= number.integer <= 6");

const filters = scope({
  textScalarLeaf: { kind: "'text'", operator: textScalarOp, value: "string" },
  textSetLeaf: { kind: "'text'", operator: setOp, values: "string[]" },
  textUnaryLeaf: { kind: "'text'", operator: unaryOp },
  textFilter: "textScalarLeaf | textSetLeaf | textUnaryLeaf",

  numberScalarLeaf: { kind: "'number'", operator: numberScalarOp, value: "number" },
  numberRangeLeaf: { kind: "'number'", operator: rangeOp, from: "number", to: "number" },
  numberSetLeaf: { kind: "'number'", operator: setOp, values: "number[]" },
  numberUnaryLeaf: { kind: "'number'", operator: unaryOp },
  numberFilter: "numberScalarLeaf | numberRangeLeaf | numberSetLeaf | numberUnaryLeaf",

  enumEqualityLeaf: { kind: "'enum'", operator: equalityOp, value: "string" },
  enumSetLeaf: { kind: "'enum'", operator: setOp, values: "string[]" },
  enumUnaryLeaf: { kind: "'enum'", operator: unaryOp },
  enumFilter: "enumEqualityLeaf | enumSetLeaf | enumUnaryLeaf",

  booleanEqualityLeaf: { kind: "'boolean'", operator: equalityOp, value: "boolean" },
  booleanUnaryLeaf: { kind: "'boolean'", operator: unaryOp },
  booleanFilter: "booleanEqualityLeaf | booleanUnaryLeaf",

  datePreset: {
    kind: "'date'",
    operator: datePresetOp,
    unit,
    timeZone,
    anchor: plainDateTime,
    "end?": plainDateTime,
    "weekStartsOn?": weekStartsOn,
  },
  dateUnaryLeaf: { kind: "'date'", operator: unaryOp },
  dateFilter: "datePreset | dateUnaryLeaf",

  arrayOpsLeaf: { kind: "'array'", operator: arrayOp, values: "(string | number)[]" },
  arrayUnaryLeaf: { kind: "'array'", operator: unaryOp },
  arrayFilter: "arrayOpsLeaf | arrayUnaryLeaf",

  fieldFilter: "textFilter | numberFilter | enumFilter | booleanFilter | dateFilter | arrayFilter",
  columnFilter: { field: "string", filter: "fieldFilter" },
  filtersRequest: "columnFilter[]",

  columnNode: { type: "'column'", field: "string", filter: "fieldFilter" },
  andNode: { type: "'and'", nodes: "node[]" },
  orNode: { type: "'or'", nodes: "node[]" },
  notNode: { type: "'not'", node: "node" },
  node: "columnNode | andNode | orNode | notNode",

  sortItem: { field: "string", dir: "'asc' | 'desc'" },
  sort: "sortItem[]",
}).export();

/**
 * Validates a `text`-kind field filter (the model's `TextFilter`): a single
 * `value` with a text operator (`TEXT_SCALAR_OPERATORS`), a `values[]` list with
 * `inArray`/`notInArray`, or a unary `isNull`/`isNotNull`.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { TextFilterSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = { kind: "text", operator: "contains", value: "ada" };
 * TextFilterSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * TextFilterSchema({ kind: "text", operator: "lt", value: "a" }) instanceof type.errors;
 * // → true (`lt` isn't a text operator)
 * ```
 */
export const TextFilterSchema = filters.textFilter;

/**
 * Validates a `number`-kind field filter (the model's `NumberFilter`): a
 * comparison `value`, a `from` + `to` range, a `values[]` list, or a unary
 * operator.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { NumberFilterSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = { kind: "number", operator: "between", from: 10, to: 100 };
 * NumberFilterSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * NumberFilterSchema({ kind: "number", operator: "between", from: 10 }) instanceof type.errors;
 * // → true (a range needs `to`)
 * ```
 */
export const NumberFilterSchema = filters.numberFilter;

/**
 * Validates an `enum`-kind field filter (the model's `EnumFilter`): `eq`/`ne`
 * with a string `value`, a `values[]` list, or a unary operator. Which enum
 * values are allowed is not checked here.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { EnumFilterSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = { kind: "enum", operator: "inArray", values: ["open", "done"] };
 * EnumFilterSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * EnumFilterSchema({ kind: "enum", operator: "contains", value: "op" }) instanceof type.errors;
 * // → true (no text matching on enums)
 * ```
 */
export const EnumFilterSchema = filters.enumFilter;

/**
 * Validates a `boolean`-kind field filter (the model's `BooleanFilter`):
 * `eq`/`ne` with a boolean `value`, or a unary operator.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { BooleanFilterSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = { kind: "boolean", operator: "eq", value: true };
 * BooleanFilterSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * BooleanFilterSchema({ kind: "boolean", operator: "eq", value: "true" }) instanceof type.errors;
 * // → true (a string, not a boolean)
 * ```
 */
export const BooleanFilterSchema = filters.booleanFilter;

/**
 * Validates a `date` period preset (the model's `DatePreset`): `operator`
 * (`is`/`before`/`after`/`between`), `unit`, a real IANA `timeZone`, a
 * `Temporal.PlainDateTime` string `anchor` (and optional `end`), and an optional
 * `weekStartsOn` integer 0–6. A date-only `anchor` such as `"2026-02-01"` also
 * passes, since `Temporal.PlainDateTime.from` accepts it.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { DatePresetSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = {
 *   kind: "date", operator: "is", unit: "month",
 *   timeZone: "America/Los_Angeles", anchor: "2026-02-01T00:00:00",
 * };
 * DatePresetSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * DatePresetSchema({ ...input, timeZone: "Mars/Olympus" }) instanceof type.errors;
 * // → true (not an IANA zone)
 * ```
 */
export const DatePresetSchema = filters.datePreset;

/**
 * Validates a `date`-kind field filter (the model's `DateFilter`): a period
 * preset (see `DatePresetSchema`) or a unary `isNull`/`isNotNull`.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { DateFilterSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = { kind: "date", operator: "isNull" };
 * DateFilterSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * DateFilterSchema({ kind: "date", operator: "eq", value: "2026-02-01" }) instanceof type.errors;
 * // → true (dates use presets, not `eq`)
 * ```
 */
export const DateFilterSchema = filters.dateFilter;

/**
 * Validates an `array`-kind field filter (the model's `ArrayFilter`): an
 * array-column operator (`arrayContains`/`arrayContained`/`arrayOverlaps`) with a
 * `values[]` list of strings/numbers, or a unary operator.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { ArrayFilterSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = { kind: "array", operator: "arrayOverlaps", values: ["a", 1] };
 * ArrayFilterSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * ArrayFilterSchema({ kind: "array", operator: "inArray", values: ["a"] }) instanceof type.errors;
 * // → true (use the array operators)
 * ```
 */
export const ArrayFilterSchema = filters.arrayFilter;

/**
 * Validates any field filter (the model's `FieldFilter`): the union of the six
 * per-kind schemas, so the `operator` must be valid for the `kind`.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { FieldFilterSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = { kind: "number", operator: "gte", value: 10 };
 * FieldFilterSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * FieldFilterSchema({ kind: "number", operator: "contains", value: "1" }) instanceof type.errors;
 * // → true (`contains` isn't a number operator)
 * ```
 */
export const FieldFilterSchema = filters.fieldFilter;

/**
 * Validates one `ColumnFilter`: a public `field` name plus its `filter`. The
 * field name is not checked against an allow-list here; the adapters' `spec`
 * does that.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { ColumnFilterSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = { field: "status", filter: { kind: "enum", operator: "eq", value: "open" } };
 * ColumnFilterSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * const bad = { field: "status", filter: { kind: "enum", operator: "eq" } };
 * ColumnFilterSchema(bad) instanceof type.errors;
 * // → true (`eq` needs a `value`)
 * ```
 */
export const ColumnFilterSchema = filters.columnFilter;

/**
 * Flat AND-combined list of column filters (the common case): validates a
 * `FiltersRequest` (`ColumnFilter[]`), e.g. a request body, before it reaches an
 * adapter.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { FiltersRequestSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = [
 *   { field: "name", filter: { kind: "text", operator: "contains", value: "ada" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 10 } },
 * ];
 * FiltersRequestSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * FiltersRequestSchema([{ field: "name" }]) instanceof type.errors;
 * // → true (missing `filter`)
 * ```
 */
export const FiltersRequestSchema = filters.filtersRequest;

/**
 * Validates one sort entry `{ field, dir }` (the model's `SortItem`); `dir` is
 * `"asc"` or `"desc"`.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { SortItemSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = { field: "createdAt", dir: "desc" };
 * SortItemSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * SortItemSchema({ field: "createdAt", dir: "down" }) instanceof type.errors;
 * // → true (`dir` must be "asc" or "desc")
 * ```
 */
export const SortItemSchema = filters.sortItem;

/**
 * A `{ field, dir }[]` sort list (the model's `Sort`), applied in order.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { SortSchema } from "@xtandard/lib/filters/arktype";
 *
 * const input = [
 *   { field: "createdAt", dir: "desc" },
 *   { field: "name", dir: "asc" },
 * ];
 * SortSchema(input);
 * // → `input` (an `ArkErrors` instead when invalid)
 * SortSchema([{ field: "name" }]) instanceof type.errors;
 * // → true (missing `dir`)
 * ```
 */
export const SortSchema = filters.sort;

/**
 * Recursive and/or/not tree (the model's `FilterNode`), defined in the shared
 * scope so `node` can reference itself.
 *
 * **Known issue:** with arktype 2.2.1, calling this schema throws
 * `TypeError: this.andNode1Apply is not a function` for every input (arktype
 * fails to compile the exported recursive alias). The flat `FiltersRequestSchema`
 * is unaffected. Until that is fixed, validate trees with the valibot, zod or
 * effect subpath.
 *
 * @example
 * ```ts
 * import { FilterNodeSchema } from "@xtandard/lib/filters/arktype";
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
 * FilterNodeSchema(input); // currently throws a TypeError (see the known issue above)
 * ```
 */
export const FilterNodeSchema = filters.node;
