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

export const TextFilterSchema = filters.textFilter;
export const NumberFilterSchema = filters.numberFilter;
export const EnumFilterSchema = filters.enumFilter;
export const BooleanFilterSchema = filters.booleanFilter;
export const DatePresetSchema = filters.datePreset;
export const DateFilterSchema = filters.dateFilter;
export const ArrayFilterSchema = filters.arrayFilter;
export const FieldFilterSchema = filters.fieldFilter;
export const ColumnFilterSchema = filters.columnFilter;
/** Flat AND-combined list of column filters (the common case). */
export const FiltersRequestSchema = filters.filtersRequest;
export const SortItemSchema = filters.sortItem;
/** A `{ field, dir }[]` sort list. */
export const SortSchema = filters.sort;
/** Recursive and/or/not tree. */
export const FilterNodeSchema = filters.node;
