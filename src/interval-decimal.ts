/**
 * Arbitrary-precision decimal intervals — the generic `Interval<T>` engine bound
 * to [decimal.js](https://github.com/MikeMcl/decimal.js) `Decimal` values. Use
 * this instead of `NumberInterval` when you need exact decimals and the IEEE-754
 * float fuzz of `number` is unacceptable (e.g. `[0.1,0.3].length()` is `0.2`, not
 * `0.19999999999999998`, and `toString()` is `"[0.1,0.3]"`).
 *
 * CONTINUOUS — decimals are dense, so there's no true successor (no `next`/`prev`).
 * Ordering, membership, set operations, and parse/format are EXACT (backed by
 * decimal.js). `measure`/`length()`/`middle()` round-trip through a JS `number`
 * (the engine's `measure` return type), so the *result* of a measure is a double —
 * but it's computed exactly first, so clean decimals stay clean. decimal.js is a
 * **peer dependency**.
 */

// Named, not default: decimal.js ships one CJS-typed `.d.ts`, so under `nodenext` a default
// import from an ES module is the whole module (TS2709 in our `.d.mts`). The named export is the
// same class in every resolution mode, ESM and CJS.
import { Decimal } from "decimal.js";

import { type BoundIntervalType, defineIntervalType, type IntervalDomain } from "./interval.ts";

/**
 * Exact-decimal {@link IntervalDomain} backed by decimal.js. Continuous;
 * finite-only (`NaN`/`±Infinity` fail `isValid`). Bound to a class as
 * {@link DecimalInterval}.
 *
 * @example
 * ```ts
 * import { Decimal } from "decimal.js";
 * import { parseInterval } from "@xtandard/lib/interval";
 * import { decimalDomain } from "@xtandard/lib/decimal";
 *
 * decimalDomain.isValid?.(new Decimal(NaN)); // false
 * parseInterval(decimalDomain, "[0.1,0.3]").length(); // 0.2
 * ```
 */
export const decimalDomain: IntervalDomain<Decimal> = {
  name: "decimal",
  compare: (a, b) => a.cmp(b),
  isValid: (value) => value.isFinite(),
  measure: (lower, upper) => upper.minus(lower).toNumber(),
  add: (value, delta) => value.plus(delta),
  format: (value) => value.toString(),
  parse: (text) => new Decimal(text),
};

/**
 * Interval over decimal.js `Decimal` values — exact, continuous.
 *
 * @example
 * ```ts
 * import { Decimal } from "decimal.js";
 * import { DecimalInterval } from "@xtandard/lib/decimal";
 *
 * const r = DecimalInterval.closed(new Decimal("0.1"), new Decimal("0.3"));
 * r.length(); // 0.2 (no float fuzz)
 * r.toString(); // "[0.1,0.3]"
 * r.contains(new Decimal("0.2")); // true
 * DecimalInterval.parse("[1.000000000000000000000000000001,2]").toString();
 * // "[1.000000000000000000000000000001,2]" (31 significant digits kept)
 * ```
 */
export const DecimalInterval: BoundIntervalType<Decimal> = defineIntervalType(decimalDomain);
/** Instance type of {@link DecimalInterval}. */
export type DecimalInterval = InstanceType<typeof DecimalInterval>;
