/**
 * Exact-decimal intervals backed by [big.js](https://github.com/MikeMcl/big.js) —
 * a minimalist arbitrary-precision decimal. Same model as `@xtandard/lib/decimal`
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

/**
 * Exact-decimal {@link IntervalDomain} backed by big.js. Continuous. Bound to a
 * class as {@link BigInterval}; use it directly with `parseInterval`/`mergeIntervals`.
 *
 * @example
 * ```ts
 * import Big from "big.js";
 * import { parseInterval } from "@xtandard/lib/interval";
 * import { bigDomain } from "@xtandard/lib/big";
 *
 * bigDomain.compare(new Big("0.1"), new Big("0.10")); // 0
 * parseInterval(bigDomain, "[1.5,2.5]").toString(); // "[1.5,2.5]"
 * ```
 */
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
 * @example
 * ```ts
 * import Big from "big.js";
 * import { BigInterval } from "@xtandard/lib/big";
 *
 * const r = BigInterval.closed(new Big("0.1"), new Big("0.3"));
 * r.length(); // 0.2 (no float fuzz)
 * r.toString(); // "[0.1,0.3]"
 * r.contains(new Big("0.2")); // true
 * r.middle()?.toString(); // "0.2"
 * ```
 */
export const BigInterval: BoundIntervalType<BigValue> = defineIntervalType(bigDomain);
/** Instance type of {@link BigInterval}. */
export type BigInterval = InstanceType<typeof BigInterval>;
