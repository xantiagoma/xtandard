// xtandard/interval — a generic, immutable Interval<T> over any ordered type
// (Guava Range + DiscreteDomain model), plus built-in domains for the JS
// primitives (number, integer, bigint, Date). Zero runtime dependencies.
//
// See docs/INTERVAL.md for the full guide.

export { Interval, defineIntervalType, mergeIntervals, parseInterval } from "./interval.ts";
export type { Bound, BoundIntervalType, IntervalDomain, IntervalSpec } from "./interval.ts";

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
