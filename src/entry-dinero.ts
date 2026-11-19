/**
 * Money intervals: the generic Interval<T> engine bound to
 * dinero.js v2 values (peer dependency `dinero.js`, which also re-exports the
 * currency definitions). See docs/INTERVAL.md#money-intervals.
 *
 * Import from `@xtandard/lib/dinero`.
 *
 * @module dinero
 */

export { createDineroInterval, dineroDomain } from "./interval-dinero.ts";
export type { DineroInterval } from "./interval-dinero.ts";
