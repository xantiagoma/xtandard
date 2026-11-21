/**
 * A generic, immutable Interval<T> over any ordered type
 * (Guava Range + DiscreteDomain model), plus built-in domains for the JS
 * primitives (number, integer, bigint, Date), and IntervalSet / IntervalMap
 * (Guava RangeSet / RangeMap) over any domain. Zero runtime dependencies.
 *
 * See docs/INTERVAL.md for the full guide.
 *
 * Import from `@xtandard/lib/interval`.
 *
 * @module interval
 */

export { Interval, defineIntervalType, mergeIntervals, parseInterval } from "./interval.ts";
export type { Bound, BoundIntervalType, IntervalDomain, IntervalSpec } from "./interval.ts";
export { IntervalSet } from "./interval-set.ts";
export { IntervalMap } from "./interval-map.ts";
export type { IntervalMapEntry, IntervalMapOptions } from "./interval-map.ts";

export {
  BigIntInterval,
  bigIntDomain,
  createOrdinalInterval,
  DateInterval,
  dateDomain,
  IntegerInterval,
  integerDomain,
  NumberInterval,
  numberDomain,
  StringInterval,
  stringDomain,
} from "./interval-domains.ts";
