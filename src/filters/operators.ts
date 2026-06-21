/**
 * Operator vocabularies, aligned with Drizzle's operators
 * (https://orm.drizzle.team/docs/operators). Operators are grouped by argument
 * SHAPE (how many values they take), which is what the valibot model and the
 * Drizzle where-builder both branch on:
 *
 * - scalar  → one `value`            (eq, ne, lt, gt, lte, gte, like, ilike, notIlike, contains, startsWith, endsWith)
 * - range   → `from` + `to`          (between, notBetween)
 * - set     → `values[]`             (inArray, notInArray)
 * - arrayOp → `values[]` (pg arrays) (arrayContains, arrayContained, arrayOverlaps)
 * - unary   → no value               (isNull, isNotNull)
 * - date    → the period preset      (is, before, after, between → resolves to gte/lt)
 *
 * `contains`/`startsWith`/`endsWith` are ergonomic text affordances the builder
 * lowers to `ilike` with an escaped `%` pattern; `like`/`ilike`/`notIlike` pass
 * the pattern through verbatim. `and`/`or`/`not` are COMBINATORS (FilterNode),
 * not field operators.
 */

export const UNARY_OPERATORS = ["isNull", "isNotNull"] as const;
export const RANGE_OPERATORS = ["between", "notBetween"] as const;
export const SET_OPERATORS = ["inArray", "notInArray"] as const;
export const ARRAY_COL_OPERATORS = ["arrayContains", "arrayContained", "arrayOverlaps"] as const;

// Scalar (single-value) operators, split by which kinds accept them.
export const TEXT_SCALAR_OPERATORS = [
  "eq",
  "ne",
  "contains",
  "startsWith",
  "endsWith",
  "like",
  "ilike",
  "notIlike",
] as const;
export const NUMBER_SCALAR_OPERATORS = ["eq", "ne", "lt", "gt", "lte", "gte"] as const;
export const EQUALITY_OPERATORS = ["eq", "ne"] as const;

export const DATE_PRESET_OPERATORS = ["is", "before", "after", "between"] as const;

// Full per-kind operator lists (scalar + range/set/array + unary), for UI pickers.
export const TEXT_OPERATORS = [
  ...TEXT_SCALAR_OPERATORS,
  ...SET_OPERATORS,
  ...UNARY_OPERATORS,
] as const;
export const NUMBER_OPERATORS = [
  ...NUMBER_SCALAR_OPERATORS,
  ...RANGE_OPERATORS,
  ...SET_OPERATORS,
  ...UNARY_OPERATORS,
] as const;
export const ENUM_OPERATORS = [
  ...EQUALITY_OPERATORS,
  ...SET_OPERATORS,
  ...UNARY_OPERATORS,
] as const;
export const BOOLEAN_OPERATORS = [...EQUALITY_OPERATORS, ...UNARY_OPERATORS] as const;
export const DATE_OPERATORS = [...DATE_PRESET_OPERATORS, ...UNARY_OPERATORS] as const;
export const ARRAY_OPERATORS = [...ARRAY_COL_OPERATORS, ...UNARY_OPERATORS] as const;

export type UnaryOperator = (typeof UNARY_OPERATORS)[number];
export type TextOperator = (typeof TEXT_OPERATORS)[number];
export type NumberOperator = (typeof NUMBER_OPERATORS)[number];
export type EnumOperator = (typeof ENUM_OPERATORS)[number];
export type BooleanOperator = (typeof BOOLEAN_OPERATORS)[number];
export type DateOperator = (typeof DATE_OPERATORS)[number];
export type ArrayOperator = (typeof ARRAY_OPERATORS)[number];
