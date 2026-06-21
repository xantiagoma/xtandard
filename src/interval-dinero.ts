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
 * defers to dinero's own (scale-aware) comparison.
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
 * {@link defineIntervalType}). The string form is the currency's minor units:
 *
 *   import { dinero, USD } from "dinero.js";
 *   const UsdInterval = createDineroInterval(USD);
 *
 *   const tier = UsdInterval.closed(
 *     dinero({ amount: 5_000, currency: USD }),  // $50.00
 *     dinero({ amount: 10_000, currency: USD }), // $100.00
 *   );
 *   tier.contains(dinero({ amount: 7_500, currency: USD })); // true
 *   tier.toString(); // "[5000,10000]"  (minor units)
 *   UsdInterval.parse("[5000,10000]");
 */
export function createDineroInterval<TCurrency extends string>(
  currency: DineroCurrency<number, TCurrency>,
): BoundIntervalType<Dinero<number, TCurrency>> {
  return defineIntervalType(dineroDomain(currency));
}
