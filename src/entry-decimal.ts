/**
 * Arbitrary-precision decimal intervals: the generic
 * Interval<T> engine bound to decimal.js `Decimal` values (peer dependency
 * `decimal.js`). Exact alternative to NumberInterval. See
 * docs/INTERVAL.md#decimal-intervals.
 *
 * Import from `@xtandard/lib/decimal`.
 *
 * @module decimal
 */

export { DecimalInterval, decimalDomain } from "./interval-decimal.ts";
