/**
 * Exact-decimal intervals backed by [bignumber.js](https://github.com/MikeMcl/bignumber.js)
 * — arbitrary-precision decimals with base conversion (popular in finance/crypto).
 * Same model as `@xtandard/lib/decimal`; pick the big-number library you already use.
 * CONTINUOUS (decimals are dense). bignumber.js is a **peer dependency**.
 *
 * Ordering, membership, and `toString`/`parse` are exact; `measure`/`length()`/
 * `middle()` round-trip through a JS `number`. Members must be finite — `NaN`/
 * `±Infinity` are rejected by `contains`.
 */

// Default, not named: bignumber.js's `.d.cts` is `export = BigNumber`, where the named
// `BigNumber` is only a (private static) value (TS2749 in our `.d.cts`). The default export is the
// class in both its `.d.mts` and `.d.cts`.
import BigNumber from "bignumber.js";

import { type BoundIntervalType, defineIntervalType, type IntervalDomain } from "./interval.ts";

/**
 * Exact-decimal {@link IntervalDomain} backed by bignumber.js. Continuous;
 * finite-only (`NaN`/`±Infinity` fail `isValid`). Bound to a class as
 * {@link BigNumberInterval}.
 *
 * @example
 * ```ts
 * import BigNumber from "bignumber.js";
 * import { parseInterval } from "@xtandard/lib/interval";
 * import { bigNumberDomain } from "@xtandard/lib/bignumber";
 *
 * bigNumberDomain.isValid?.(new BigNumber(Infinity)); // false
 * parseInterval(bigNumberDomain, "[0.1,0.3]").length(); // 0.2
 * ```
 */
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
 * @example
 * ```ts
 * import BigNumber from "bignumber.js";
 * import { BigNumberInterval } from "@xtandard/lib/bignumber";
 *
 * const r = BigNumberInterval.closed(new BigNumber("0.1"), new BigNumber("0.3"));
 * r.length(); // 0.2 (no float fuzz)
 * r.toString(); // "[0.1,0.3]"
 * r.contains(new BigNumber("0.25")); // true
 * r.contains(new BigNumber(NaN)); // false
 * ```
 */
export const BigNumberInterval: BoundIntervalType<BigNumber> = defineIntervalType(bigNumberDomain);
/** Instance type of {@link BigNumberInterval}. */
export type BigNumberInterval = InstanceType<typeof BigNumberInterval>;
