/**
 * Exact-decimal intervals backed by [big.js](https://github.com/MikeMcl/big.js) —
 * a minimalist arbitrary-precision decimal. Same model as `xtandard/decimal`
 * (decimal.js) but a much smaller dependency; pick whichever big-number library
 * you already use. CONTINUOUS (decimals are dense). big.js is a **peer dependency**.
 *
 * Ordering, membership, and `toString`/`parse` are exact; `measure`/`length()`/
 * `middle()` round-trip through a JS `number` (the engine's `measure` type).
 * big.js values are always finite — it throws on `NaN`/`Infinity` construction —
 * so there is no `isValid` guard.
 */

import Big from "big.js";

import { type BoundIntervalType, defineIntervalType, type IntervalDomain } from "./interval.ts";

type BigValue = InstanceType<typeof Big>;

/** Exact-decimal {@link IntervalDomain} backed by big.js. Continuous. */
export const bigDomain: IntervalDomain<BigValue> = {
  name: "big",
  compare: (a, b) => a.cmp(b),
  measure: (lower, upper) => upper.minus(lower).toNumber(),
  add: (value, delta) => value.plus(delta),
  format: (value) => value.toString(),
  parse: (text) => new Big(text),
};

/**
 * Interval over big.js `Big` values — exact, continuous.
 *
 *   import { BigInterval } from "xtandard/big";
 *   import Big from "big.js";
 *
 *   BigInterval.closed(new Big("0.1"), new Big("0.3")).length(); // 0.2 (exact)
 */
export const BigInterval: BoundIntervalType<BigValue> = defineIntervalType(bigDomain);
/** Instance type of {@link BigInterval}. */
export type BigInterval = InstanceType<typeof BigInterval>;
