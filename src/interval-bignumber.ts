/**
 * Exact-decimal intervals backed by [bignumber.js](https://github.com/MikeMcl/bignumber.js)
 * — arbitrary-precision decimals with base conversion (popular in finance/crypto).
 * Same model as `xantiagoma/decimal`; pick the big-number library you already use.
 * CONTINUOUS (decimals are dense). bignumber.js is a **peer dependency**.
 *
 * Ordering, membership, and `toString`/`parse` are exact; `measure`/`length()`/
 * `middle()` round-trip through a JS `number`. Members must be finite — `NaN`/
 * `±Infinity` are rejected by `contains`.
 */

import { BigNumber } from "bignumber.js";

import { type BoundIntervalType, defineIntervalType, type IntervalDomain } from "./interval.ts";

/** Exact-decimal {@link IntervalDomain} backed by bignumber.js. Continuous; finite-only. */
export const bigNumberDomain: IntervalDomain<BigNumber> = {
  name: "bignumber",
  // comparedTo is null only when a NaN is involved; finite members never hit that.
  compare: (a, b) => a.comparedTo(b) ?? 0,
  isValid: (value) => value.isFinite(),
  measure: (lower, upper) => upper.minus(lower).toNumber(),
  add: (value, delta) => value.plus(delta),
  format: (value) => value.toString(),
  parse: (text) => new BigNumber(text),
};

/**
 * Interval over bignumber.js `BigNumber` values — exact, continuous.
 *
 *   import { BigNumberInterval } from "xantiagoma/bignumber";
 *   import { BigNumber } from "bignumber.js";
 *
 *   BigNumberInterval.closed(new BigNumber("0.1"), new BigNumber("0.3")).length(); // 0.2 (exact)
 */
export const BigNumberInterval: BoundIntervalType<BigNumber> = defineIntervalType(bigNumberDomain);
/** Instance type of {@link BigNumberInterval}. */
export type BigNumberInterval = InstanceType<typeof BigNumberInterval>;
