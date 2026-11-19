/**
 * Money intervals — the generic `Interval<T>` engine bound to dinero.js v2
 * values. DISCRETE, with the epsilon being **one minor unit** at the currency's
 * standard `exponent` (1 cent for USD, 1 whole yen for JPY), so adjacent ranges
 * merge gap-free and `length()` counts representable amounts.
 *
 * A `Dinero` value carries its own currency, so an interval is bound to ONE
 * currency: build a class with `createDineroInterval(USD)`. Stepping, measuring,
 * and the string form all work in that currency's minor units; `compare` defers
 * to dinero's own scale-aware comparison. dinero.js is a **peer dependency**.
 *
 * NOTE: values are treated on the minor-unit grid (whole cents). A value carrying
 * sub-minor-unit precision (a larger `scale`) is rounded (half-even) when stepped
 * or measured — the natural model for money ranges.
 */

import {
  compare,
  type Dinero,
  dinero,
  type DineroCurrency,
  halfEven,
  toSnapshot,
  transformScale,
} from "dinero.js";

import {
  type BoundIntervalType,
  defineIntervalType,
  type Interval,
  type IntervalDomain,
} from "./interval.ts";

/** A money interval over one currency — an `Interval` of dinero.js values. */
export type DineroInterval<TCurrency extends string = string> = Interval<Dinero<number, TCurrency>>;

/**
 * Build an {@link IntervalDomain} for one dinero.js currency. DISCRETE — the
 * epsilon is one minor unit at the currency's standard `exponent`. All
 * stepping/measuring/serialization happens in those minor units; `compare`
 * defers to dinero's own (scale-aware) comparison. {@link createDineroInterval}
 * wraps this in a class; use the domain directly with `parseInterval`/`mergeIntervals`.
 *
 * @example
 * ```ts
 * import { dinero, toDecimal, USD } from "dinero.js";
 * import { parseInterval } from "@xtandard/lib/interval";
 * import { dineroDomain } from "@xtandard/lib/dinero";
 *
 * const usdDomain = dineroDomain(USD);
 * usdDomain.name; // "dinero:USD"
 * toDecimal(usdDomain.next!(dinero({ amount: 199, currency: USD }))); // "2.00"
 * parseInterval(usdDomain, "[0,999]").length(); // 1000 (cents $0.00..$9.99)
 * ```
 */
export function dineroDomain<TCurrency extends string>(
  currency: DineroCurrency<number, TCurrency>,
): IntervalDomain<Dinero<number, TCurrency>> {
  // Amount in whole minor units at the currency's base scale (half-even rounded).
  const minorUnits = (value: Dinero<number, TCurrency>): number =>
    toSnapshot(transformScale(value, currency.exponent, halfEven)).amount;
  const ofMinorUnits = (amount: number): Dinero<number, TCurrency> => dinero({ amount, currency });

  return {
    name: `dinero:${currency.code}`,
    compare: (a, b) => compare(a, b),
    next: (value) => ofMinorUnits(minorUnits(value) + 1),
    prev: (value) => ofMinorUnits(minorUnits(value) - 1),
    measure: (lower, upper) => minorUnits(upper) - minorUnits(lower),
    add: (value, delta) => ofMinorUnits(minorUnits(value) + Math.trunc(delta)),
    format: (value) => String(minorUnits(value)),
    parse: (text) => ofMinorUnits(Number(text)),
  };
}

/**
 * Bind a dinero.js currency to a `new`-able interval CLASS (see
 * {@link defineIntervalType}). The string form is the currency's minor units.
 *
 * @example
 * ```ts
 * import { dinero, USD } from "dinero.js";
 * import { createDineroInterval } from "@xtandard/lib/dinero";
 *
 * const UsdInterval = createDineroInterval(USD);
 * const usd = (cents: number) => dinero({ amount: cents, currency: USD });
 *
 * const tier = UsdInterval.closed(usd(5_000), usd(10_000)); // $50.00 to $100.00
 * tier.contains(usd(7_500)); // true
 * tier.length(); // 5001 (cents, both ends included)
 * tier.toString(); // "[5000,10000]" (minor units)
 * UsdInterval.closed(usd(100), usd(105)).union(UsdInterval.closed(usd(106), usd(110)))?.toString();
 * // "[100,110]" (adjacent cents merge)
 * ```
 */
export function createDineroInterval<TCurrency extends string>(
  currency: DineroCurrency<number, TCurrency>,
): BoundIntervalType<Dinero<number, TCurrency>> {
  return defineIntervalType(dineroDomain(currency));
}
