/**
 * Built-in {@link IntervalDomain}s for primitive ordered types, plus a ready
 * `new`-able class for each. Temporal domains (Instant, ZonedDateTime, …) are
 * built on top of these in consuming code via {@link defineIntervalType} — this
 * entry point stays dependency-free.
 */

import { defineIntervalType, type IntervalDomain } from "./interval";

/** Normalize any difference to the `-1 | 0 | 1` shape `IntervalDomain.compare` expects. */
function sign(delta: number): number {
  return delta < 0 ? -1 : delta > 0 ? 1 : 0;
}

/**
 * Real numbers on the EXTENDED line — CONTINUOUS (no `next`). `±Infinity` are
 * real values, so a closed bracket on infinity is meaningful (`[-Infinity,5]`
 * includes `-∞`). Only `NaN` is rejected (not comparable).
 */
export const numberDomain: IntervalDomain<number> = {
  name: "number",
  compare: (a, b) => sign(a - b),
  isValid: (value) => !Number.isNaN(value),
  negativeInfinity: -Infinity,
  positiveInfinity: Infinity,
  measure: (lower, upper) => upper - lower,
  add: (value, delta) => value + delta,
  format: (value) =>
    value === Infinity ? "+Infinity" : value === -Infinity ? "-Infinity" : String(value),
  parse: (text) => {
    const value = Number(text);
    if (Number.isNaN(value)) throw new Error(`invalid number: "${text}"`);

    return value;
  },
};

/** Integers — DISCRETE (epsilon 1): `[1,5] ∪ [6,10] = [1,10]`. */
export const integerDomain: IntervalDomain<number> = {
  name: "integer",
  compare: (a, b) => sign(a - b),
  isValid: (value) => Number.isInteger(value),
  next: (value) => value + 1,
  prev: (value) => value - 1,
  measure: (lower, upper) => upper - lower,
  add: (value, delta) => value + Math.trunc(delta),
  format: (value) => String(value),
  parse: (text) => {
    const value = Number(text);
    if (!Number.isInteger(value)) throw new Error(`invalid integer: "${text}"`);

    return value;
  },
};

/** Big integers — DISCRETE (epsilon 1n). */
export const bigIntDomain: IntervalDomain<bigint> = {
  name: "bigint",
  compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  next: (value) => value + 1n,
  prev: (value) => value - 1n,
  measure: (lower, upper) => Number(upper - lower),
  add: (value, delta) => value + BigInt(Math.trunc(delta)),
  format: (value) => value.toString(),
  parse: (text) => BigInt(text),
};

/** `Date` timestamps — CONTINUOUS (preserves `[ISO,ISO]`); `measure`/`add` in ms. */
export const dateDomain: IntervalDomain<Date> = {
  name: "date",
  compare: (a, b) => sign(a.getTime() - b.getTime()),
  isValid: (value) => !Number.isNaN(value.getTime()),
  measure: (lower, upper) => upper.getTime() - lower.getTime(),
  add: (value, delta) => new Date(value.getTime() + delta),
  format: (value) => value.toISOString(),
  parse: (text) => {
    const value = new Date(text);
    if (Number.isNaN(value.getTime())) throw new Error(`invalid date: "${text}"`);

    return value;
  },
};

/**
 * Strings in lexicographic (UTF-16 code-unit) order — CONTINUOUS. Useful for
 * keyspace / shard ranges, prefix scans, alphabetical buckets, and geohash
 * spatial ranges (geohashes sort lexicographically). Code-unit order, NOT
 * locale-aware. No `measure` (no natural distance between strings).
 *
 * NOTE: the `[a,b]` string form splits on the FIRST comma, so values containing
 * `,` / `[` / `]` / `(` / `)` are not round-trippable via `parse`/`toString`
 * (every other operation is unaffected).
 */
export const stringDomain: IntervalDomain<string> = {
  name: "string",
  compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  format: (value) => value,
  parse: (text) => text,
};

// Each export is a `new`-able class bound to its domain; the same-named type
// alias is its instance type (`const r: NumberInterval = new NumberInterval(…)`).

/** Interval over real `number`s on the extended line ({@link numberDomain}, continuous). */
export const NumberInterval = defineIntervalType(numberDomain);
/** Instance type of {@link NumberInterval}. */
export type NumberInterval = InstanceType<typeof NumberInterval>;

/** Interval over integer `number`s ({@link integerDomain}, discrete, ε 1). */
export const IntegerInterval = defineIntervalType(integerDomain);
/** Instance type of {@link IntegerInterval}. */
export type IntegerInterval = InstanceType<typeof IntegerInterval>;

/** Interval over `bigint`s ({@link bigIntDomain}, discrete, ε 1n). */
export const BigIntInterval = defineIntervalType(bigIntDomain);
/** Instance type of {@link BigIntInterval}. */
export type BigIntInterval = InstanceType<typeof BigIntInterval>;

/** Interval over `Date`s ({@link dateDomain}, continuous, ms-measured). */
export const DateInterval = defineIntervalType(dateDomain);
/** Instance type of {@link DateInterval}. */
export type DateInterval = InstanceType<typeof DateInterval>;

/** Interval over lexicographically-ordered `string`s ({@link stringDomain}, continuous). */
export const StringInterval = defineIntervalType(stringDomain);
/** Instance type of {@link StringInterval}. */
export type StringInterval = InstanceType<typeof StringInterval>;

/**
 * Build a DISCRETE interval class over an ordered list of string labels (a
 * "small enum": sizes `XS < S < M < L < XL`, priority/log levels, …). Ordering
 * is the list position, so adjacent labels merge and `length()` counts labels.
 *
 * The interval operates on the list **index** (an integer); use `.index(label)`
 * to convert and `.label(i)` back. `toString()`/`parse()` use the labels, so the
 * string form reads `"[S,L]"`.
 *
 *   const Size = createOrdinalInterval(["XS", "S", "M", "L", "XL"]);
 *   const r = Size.closed(Size.index("S"), Size.index("L"));
 *   r.toString();                  // "[S,L]"
 *   r.length();                    // 3  ({S, M, L})
 *   r.contains(Size.index("M"));   // true
 *   Size.parse("[S,L]").toString(); // "[S,L]"
 */
export function createOrdinalInterval<V extends string>(labels: readonly V[]) {
  const domain: IntervalDomain<number> = {
    name: `ordinal[${labels.length}]`,
    compare: (a, b) => sign(a - b),
    isValid: (i) => Number.isInteger(i) && i >= 0 && i < labels.length,
    next: (i) => i + 1,
    prev: (i) => i - 1,
    measure: (lower, upper) => upper - lower,
    add: (value, delta) => value + Math.trunc(delta),
    format: (i) => labels[i] ?? String(i),
    parse: (text) => {
      const i = labels.findIndex((label) => label === text);
      if (i < 0) throw new Error(`invalid ordinal label: "${text}"`);

      return i;
    },
  };

  return Object.assign(defineIntervalType(domain), {
    /** The ordered label list this class is bound to. */
    labels,
    /** The list position of a label (its comparable value), or `-1` if unknown. */
    index: (label: V): number => labels.indexOf(label),
    /** The label at a given position. */
    label: (i: number): V | undefined => labels[i],
  });
}
