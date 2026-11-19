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
 * includes `-∞`). Only `NaN` is rejected (not comparable). Bound to a class as
 * {@link NumberInterval}; also a handy base to spread into a custom domain.
 *
 * @example
 * ```ts
 * import { numberDomain, parseInterval } from "@xtandard/lib/interval";
 *
 * numberDomain.compare(1, 2); // -1
 * numberDomain.isValid?.(NaN); // false
 * parseInterval(numberDomain, "[-Infinity,0]").contains(-Infinity); // true
 * ```
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

/**
 * Integers — DISCRETE (epsilon 1): `[1,5] ∪ [6,10] = [1,10]`. Non-integers fail
 * `isValid`; `length()` counts elements. Bound to a class as {@link IntegerInterval}.
 *
 * @example
 * ```ts
 * import { integerDomain, parseInterval } from "@xtandard/lib/interval";
 *
 * integerDomain.next?.(5); // 6
 * parseInterval(integerDomain, "[1,5]").length(); // 5 (counts elements)
 * parseInterval(integerDomain, "(0,5]").toString(); // "[1,5]"
 * ```
 */
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

/**
 * Big integers — DISCRETE (epsilon 1n). Exact past `Number.MAX_SAFE_INTEGER`;
 * only `length()` converts to a `number`. Bound to a class as {@link BigIntInterval}.
 *
 * @example
 * ```ts
 * import { bigIntDomain, parseInterval } from "@xtandard/lib/interval";
 *
 * bigIntDomain.next?.(9n); // 10n
 * parseInterval(bigIntDomain, "[0,9007199254740993]").contains(9007199254740993n); // true
 * ```
 */
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

/**
 * `Date` timestamps — CONTINUOUS (preserves `[ISO,ISO]`); `measure`/`add` in ms.
 * Invalid Dates fail `isValid`. Bound to a class as {@link DateInterval}.
 *
 * @example
 * ```ts
 * import { dateDomain, parseInterval } from "@xtandard/lib/interval";
 *
 * dateDomain.measure?.(new Date("2025-01-01T00:00:00Z"), new Date("2025-01-02T00:00:00Z")); // 86400000
 * parseInterval(dateDomain, "[2025-01-01T00:00:00.000Z,2025-04-01T00:00:00.000Z)")
 *   .contains(new Date("2025-02-14")); // true
 * ```
 */
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
 *
 * @example
 * ```ts
 * import { parseInterval, stringDomain } from "@xtandard/lib/interval";
 *
 * stringDomain.compare("Z", "a"); // -1 (code-unit order: uppercase sorts first)
 * parseInterval(stringDomain, "[a,n)").contains("mango"); // true
 * ```
 */
export const stringDomain: IntervalDomain<string> = {
  name: "string",
  compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  format: (value) => value,
  parse: (text) => text,
};

// Each export is a `new`-able class bound to its domain; the same-named type
// alias is its instance type (`const r: NumberInterval = new NumberInterval(…)`).

/**
 * Interval over real `number`s on the extended line ({@link numberDomain}, continuous).
 *
 * @example
 * ```ts
 * import { NumberInterval } from "@xtandard/lib/interval";
 *
 * const r = NumberInterval.closedOpen(0, 10); // [0,10)
 * r.contains(10); // false
 * r.length(); // 10
 * r.union(NumberInterval.closed(10, 20))?.toString(); // "[0,20]"
 * r.gap(NumberInterval.closed(15, 20))?.toString(); // "[10,15)"
 * ```
 */
export const NumberInterval = defineIntervalType(numberDomain);
/** Instance type of {@link NumberInterval}. */
export type NumberInterval = InstanceType<typeof NumberInterval>;

/**
 * Interval over integer `number`s ({@link integerDomain}, discrete, ε 1).
 *
 * @example
 * ```ts
 * import { IntegerInterval } from "@xtandard/lib/interval";
 *
 * const r = IntegerInterval.closed(1, 5);
 * r.length(); // 5
 * r.union(IntegerInterval.closed(6, 10))?.toString(); // "[1,10]" (adjacent integers merge)
 * IntegerInterval.open(0, 5).toString(); // "[1,4]"
 * r.contains(2.5); // false
 * ```
 */
export const IntegerInterval = defineIntervalType(integerDomain);
/** Instance type of {@link IntegerInterval}. */
export type IntegerInterval = InstanceType<typeof IntegerInterval>;

/**
 * Interval over `bigint`s ({@link bigIntDomain}, discrete, ε 1n).
 *
 * @example
 * ```ts
 * import { BigIntInterval } from "@xtandard/lib/interval";
 *
 * const u64 = BigIntInterval.closed(0n, 2n ** 64n - 1n);
 * u64.contains(2n ** 63n); // true
 * const ids = BigIntInterval.closed(1n, 5n);
 * ids.length(); // 5
 * ids.union(BigIntInterval.closed(6n, 9n))?.toString(); // "[1,9]"
 * ```
 */
export const BigIntInterval = defineIntervalType(bigIntDomain);
/** Instance type of {@link BigIntInterval}. */
export type BigIntInterval = InstanceType<typeof BigIntInterval>;

/**
 * Interval over `Date`s ({@link dateDomain}, continuous, ms-measured).
 *
 * @example
 * ```ts
 * import { DateInterval } from "@xtandard/lib/interval";
 *
 * const q1 = DateInterval.closedOpen(
 *   new Date("2025-01-01T00:00:00Z"),
 *   new Date("2025-04-01T00:00:00Z"),
 * );
 * q1.contains(new Date("2025-02-14T12:00:00Z")); // true
 * q1.length(); // 7776000000 (ms, 90 days)
 * q1.intersection(DateInterval.atLeast(new Date("2025-03-15T00:00:00Z"))).toString();
 * // "[2025-03-15T00:00:00.000Z,2025-04-01T00:00:00.000Z)"
 * ```
 */
export const DateInterval = defineIntervalType(dateDomain);
/** Instance type of {@link DateInterval}. */
export type DateInterval = InstanceType<typeof DateInterval>;

/**
 * Interval over lexicographically-ordered `string`s ({@link stringDomain}, continuous).
 *
 * @example
 * ```ts
 * import { StringInterval } from "@xtandard/lib/interval";
 *
 * const r = StringInterval.closedOpen("a", "n");
 * r.contains("mango"); // true
 * r.contains("Mango"); // false (uppercase sorts before lowercase)
 * r.intersection(StringInterval.closedOpen("k", "z")).toString(); // "[k,n)"
 * StringInterval.closedOpen("user:", "user:￿").contains("user:42"); // true (prefix scan)
 * ```
 */
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
 * @example
 * ```ts
 * import { createOrdinalInterval } from "@xtandard/lib/interval";
 *
 * const Size = createOrdinalInterval(["XS", "S", "M", "L", "XL"]);
 * const r = Size.closed(Size.index("S"), Size.index("L"));
 * r.toString(); // "[S,L]"
 * r.length(); // 3 ({S, M, L})
 * r.contains(Size.index("M")); // true
 * Size.parse("[S,L]").toString(); // "[S,L]"
 * Size.atLeast(Size.index("M")).toString(); // "[M,+Infinity)"
 * ```
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
