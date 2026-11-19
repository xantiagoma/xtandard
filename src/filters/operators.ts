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

/**
 * The unary operators — `isNull` / `isNotNull` take no argument. Every kind
 * accepts them.
 *
 * @example Skip the value input for an argument-less operator
 * ```ts
 * import { UNARY_OPERATORS } from "@xtandard/lib/filters";
 *
 * const needsValue = (op: string) => !(UNARY_OPERATORS as readonly string[]).includes(op);
 * needsValue("isNull"); // → false
 * needsValue("eq"); // → true
 * ```
 */
export const UNARY_OPERATORS = ["isNull", "isNotNull"] as const;

/**
 * The range operators — `between` / `notBetween` take `from` + `to` (the
 * `number` kind only). `compileFilters` lowers them to `gte AND lte` /
 * `lt OR gt`, never SQL `BETWEEN`.
 *
 * @example Render two inputs (from/to) for a range operator
 * ```ts
 * import { RANGE_OPERATORS } from "@xtandard/lib/filters";
 *
 * RANGE_OPERATORS; // → ["between", "notBetween"]
 * (RANGE_OPERATORS as readonly string[]).includes("between"); // → true
 * ```
 */
export const RANGE_OPERATORS = ["between", "notBetween"] as const;

/**
 * The set operators — `inArray` / `notInArray` take a `values[]` list
 * (`text`, `number` and `enum` kinds).
 *
 * @example Render a multi-select for a set operator
 * ```ts
 * import { SET_OPERATORS } from "@xtandard/lib/filters";
 *
 * SET_OPERATORS; // → ["inArray", "notInArray"]
 * (SET_OPERATORS as readonly string[]).includes("inArray"); // → true
 * ```
 */
export const SET_OPERATORS = ["inArray", "notInArray"] as const;

/**
 * The array-column operators — `arrayContains` / `arrayContained` /
 * `arrayOverlaps` compare an array column against `values[]` (the `array` kind;
 * Postgres `@>` / `<@` / `&&`, or a SQL adapter's `dialect` equivalent).
 *
 * @example
 * ```ts
 * import { ARRAY_COL_OPERATORS } from "@xtandard/lib/filters";
 *
 * ARRAY_COL_OPERATORS; // → ["arrayContains", "arrayContained", "arrayOverlaps"]
 * (ARRAY_COL_OPERATORS as readonly string[]).includes("arrayOverlaps"); // → true
 * ```
 */
export const ARRAY_COL_OPERATORS = ["arrayContains", "arrayContained", "arrayOverlaps"] as const;

/**
 * The single-`value` operators the `text` kind accepts: equality plus the text
 * matchers. `contains`/`startsWith`/`endsWith` take a plain string (the SQL
 * adapters escape it); `like`/`ilike`/`notIlike` take a raw pattern.
 *
 * @example
 * ```ts
 * import { TEXT_SCALAR_OPERATORS } from "@xtandard/lib/filters";
 *
 * TEXT_SCALAR_OPERATORS;
 * // → ["eq", "ne", "contains", "startsWith", "endsWith", "like", "ilike", "notIlike"]
 * (TEXT_SCALAR_OPERATORS as readonly string[]).includes("contains"); // → true
 * ```
 */
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

/**
 * The single-`value` comparison operators the `number` kind accepts.
 *
 * @example
 * ```ts
 * import { NUMBER_SCALAR_OPERATORS } from "@xtandard/lib/filters";
 *
 * NUMBER_SCALAR_OPERATORS; // → ["eq", "ne", "lt", "gt", "lte", "gte"]
 * (NUMBER_SCALAR_OPERATORS as readonly string[]).includes("gte"); // → true
 * ```
 */
export const NUMBER_SCALAR_OPERATORS = ["eq", "ne", "lt", "gt", "lte", "gte"] as const;

/**
 * The equality operators `eq` / `ne` — the single-`value` operators of the
 * `enum` and `boolean` kinds.
 *
 * @example
 * ```ts
 * import { EQUALITY_OPERATORS } from "@xtandard/lib/filters";
 *
 * EQUALITY_OPERATORS; // → ["eq", "ne"]
 * (EQUALITY_OPERATORS as readonly string[]).includes("ne"); // → true
 * ```
 */
export const EQUALITY_OPERATORS = ["eq", "ne"] as const;

/**
 * The `date` kind's period-preset operators. Each takes `unit` + `timeZone` +
 * `anchor` (+ `end` for `between`) and is resolved to a half-open instant
 * window by an injected `resolveDate`.
 *
 * @example
 * ```ts
 * import { DATE_PRESET_OPERATORS } from "@xtandard/lib/filters";
 *
 * DATE_PRESET_OPERATORS; // → ["is", "before", "after", "between"]
 * (DATE_PRESET_OPERATORS as readonly string[]).includes("before"); // → true
 * ```
 */
export const DATE_PRESET_OPERATORS = ["is", "before", "after", "between"] as const;

/**
 * Every operator the `text` kind accepts (scalar + set + unary), for a UI
 * operator picker. Same list as `OPERATORS_BY_KIND.text`.
 *
 * @example Build a picker's options
 * ```ts
 * import { TEXT_OPERATORS } from "@xtandard/lib/filters";
 *
 * const options = TEXT_OPERATORS.map((op) => ({ value: op, label: op }));
 * options.length; // → 12
 * (TEXT_OPERATORS as readonly string[]).includes("lt"); // → false
 * ```
 */
export const TEXT_OPERATORS = [
  ...TEXT_SCALAR_OPERATORS,
  ...SET_OPERATORS,
  ...UNARY_OPERATORS,
] as const;

/**
 * Every operator the `number` kind accepts (scalar + range + set + unary), for
 * a UI operator picker. Same list as `OPERATORS_BY_KIND.number`.
 *
 * @example
 * ```ts
 * import { NUMBER_OPERATORS } from "@xtandard/lib/filters";
 *
 * NUMBER_OPERATORS;
 * // → ["eq", "ne", "lt", "gt", "lte", "gte", "between", "notBetween",
 * //    "inArray", "notInArray", "isNull", "isNotNull"]
 * ```
 */
export const NUMBER_OPERATORS = [
  ...NUMBER_SCALAR_OPERATORS,
  ...RANGE_OPERATORS,
  ...SET_OPERATORS,
  ...UNARY_OPERATORS,
] as const;

/**
 * Every operator the `enum` kind accepts (equality + set + unary), for a UI
 * operator picker. Same list as `OPERATORS_BY_KIND.enum`.
 *
 * @example
 * ```ts
 * import { ENUM_OPERATORS } from "@xtandard/lib/filters";
 *
 * ENUM_OPERATORS; // → ["eq", "ne", "inArray", "notInArray", "isNull", "isNotNull"]
 * (ENUM_OPERATORS as readonly string[]).includes("contains"); // → false
 * ```
 */
export const ENUM_OPERATORS = [
  ...EQUALITY_OPERATORS,
  ...SET_OPERATORS,
  ...UNARY_OPERATORS,
] as const;

/**
 * Every operator the `boolean` kind accepts (equality + unary), for a UI
 * operator picker. Same list as `OPERATORS_BY_KIND.boolean`.
 *
 * @example
 * ```ts
 * import { BOOLEAN_OPERATORS } from "@xtandard/lib/filters";
 *
 * BOOLEAN_OPERATORS; // → ["eq", "ne", "isNull", "isNotNull"]
 * ```
 */
export const BOOLEAN_OPERATORS = [...EQUALITY_OPERATORS, ...UNARY_OPERATORS] as const;

/**
 * Every operator the `date` kind accepts (period presets + unary), for a UI
 * operator picker. Same list as `OPERATORS_BY_KIND.date`.
 *
 * @example
 * ```ts
 * import { DATE_OPERATORS } from "@xtandard/lib/filters";
 *
 * DATE_OPERATORS; // → ["is", "before", "after", "between", "isNull", "isNotNull"]
 * ```
 */
export const DATE_OPERATORS = [...DATE_PRESET_OPERATORS, ...UNARY_OPERATORS] as const;

/**
 * Every operator the `array` kind accepts (array-column + unary), for a UI
 * operator picker. Same list as `OPERATORS_BY_KIND.array`.
 *
 * @example
 * ```ts
 * import { ARRAY_OPERATORS } from "@xtandard/lib/filters";
 *
 * ARRAY_OPERATORS;
 * // → ["arrayContains", "arrayContained", "arrayOverlaps", "isNull", "isNotNull"]
 * ```
 */
export const ARRAY_OPERATORS = [...ARRAY_COL_OPERATORS, ...UNARY_OPERATORS] as const;

export type UnaryOperator = (typeof UNARY_OPERATORS)[number];
export type TextOperator = (typeof TEXT_OPERATORS)[number];
export type NumberOperator = (typeof NUMBER_OPERATORS)[number];
export type EnumOperator = (typeof ENUM_OPERATORS)[number];
export type BooleanOperator = (typeof BOOLEAN_OPERATORS)[number];
export type DateOperator = (typeof DATE_OPERATORS)[number];
export type ArrayOperator = (typeof ARRAY_OPERATORS)[number];
