/**
 * Exact-RATIONAL intervals backed by [fraction.js](https://github.com/rawify/Fraction.js).
 * Unlike the decimal libraries, a `Fraction` represents `1/3` exactly (no rounding,
 * ever) and `toString`/`format` render it as `"1/3"`. CONTINUOUS (rationals are
 * dense). fraction.js is a **peer dependency**.
 *
 * `compare`, `contains`, and the `"n/d"` string form are exact rationals. Only
 * `measure`/`length()`/`middle()` round-trip through a JS `number` (the engine's
 * `measure` type), so a length is a floating-point magnitude even though the
 * endpoints stay exact.
 */

import Fraction from "fraction.js";

import { type BoundIntervalType, defineIntervalType, type IntervalDomain } from "./interval.ts";

type FractionValue = InstanceType<typeof Fraction>;

/** Exact-rational {@link IntervalDomain} backed by fraction.js. Continuous. */
export const fractionDomain: IntervalDomain<FractionValue> = {
  name: "fraction",
  compare: (a, b) => a.compare(b),
  measure: (lower, upper) => upper.sub(lower).valueOf(),
  add: (value, delta) => value.add(delta),
  format: (value) => value.toFraction(),
  parse: (text) => new Fraction(text),
};

/**
 * Interval over fraction.js `Fraction` values — exact rationals, continuous.
 *
 *   import { FractionInterval } from "@xtandard/lib/fraction";
 *   import Fraction from "fraction.js";
 *
 *   const third = (n: number) => new Fraction(n, 3);
 *   FractionInterval.closed(third(1), third(2)).toString(); // "[1/3,2/3]"  (exact)
 *   FractionInterval.closed(third(1), third(2)).contains(new Fraction(1, 2)); // true
 */
export const FractionInterval: BoundIntervalType<FractionValue> =
  defineIntervalType(fractionDomain);
/** Instance type of {@link FractionInterval}. */
export type FractionInterval = InstanceType<typeof FractionInterval>;
