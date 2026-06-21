/**
 * Temporal {@link IntervalDomain}s + ready-made interval classes for the kinds
 * that form a line: Instant, ZonedDateTime, PlainDateTime, PlainTime (CONTINUOUS
 * — `[ISO,ISO]` is preserved verbatim) and PlainDate (DISCRETE — calendar days
 * merge, epsilon 1 day). Built on the generic `Interval<T>` engine in
 * `./interval`.
 *
 * `Temporal` comes from `@js-temporal/polyfill` (the spec-reference impl, also
 * what `@gobrand/tiempo` / `@gobrand/react-calendar` bundle). The domains never
 * use `instanceof Temporal.*` — only static `compare`/`from` and instance
 * methods — so values from any TC39-compatible polyfill compare correctly.
 *
 * **Precision.** Ordering, membership, set operations, and parse/format are
 * EXACT — `compare` defers to `Temporal.*.compare` (nanosecond-precise for
 * Instant/ZonedDateTime) and the string form is round-trippable ISO. Only
 * `measure`/`add` work in **milliseconds** (days for PlainDate), because the
 * engine types them as a JS `number` (see `IntervalDomain.measure`) — and epoch
 * *nanoseconds* exceed `Number.MAX_SAFE_INTEGER` after ~104 days, so a `number`
 * can't safely carry them. Milliseconds keep `length()` an exact integer for
 * ~285,000 years. Net effect: `length()` / `middle()` / `fromStart` are
 * millisecond-granular, while `contains` / `compare` / `equals` stay
 * nanosecond-exact. Need sub-ms length? Subtract `epochNanoseconds` (bigint)
 * directly off the endpoints.
 */

import { Temporal } from "@js-temporal/polyfill";

import { defineIntervalType, type IntervalDomain } from "./interval.ts";

/** Truncate a fractional millisecond delta to a whole number for `add`. */
const truncMs = (delta: number): number => Math.trunc(delta);

/** A precise moment — CONTINUOUS; `measure`/`add` in milliseconds. */
export const instantDomain: IntervalDomain<Temporal.Instant> = {
  name: "instant",
  compare: (a, b) => Temporal.Instant.compare(a, b),
  measure: (lower, upper) => upper.epochMilliseconds - lower.epochMilliseconds,
  add: (value, delta) => value.add({ milliseconds: truncMs(delta) }),
  format: (value) => value.toString(),
  parse: (text) => Temporal.Instant.from(text),
};

/** A DST-aware zoned moment — CONTINUOUS; ordered by instant; ms `measure`/`add`. */
export const zonedDateTimeDomain: IntervalDomain<Temporal.ZonedDateTime> = {
  name: "zonedDateTime",
  compare: (a, b) => Temporal.ZonedDateTime.compare(a, b),
  measure: (lower, upper) => upper.epochMilliseconds - lower.epochMilliseconds,
  add: (value, delta) => value.add({ milliseconds: truncMs(delta) }),
  format: (value) => value.toString(),
  parse: (text) => Temporal.ZonedDateTime.from(text),
};

/** A calendar date — DISCRETE (epsilon 1 day); `measure` counts days. */
export const plainDateDomain: IntervalDomain<Temporal.PlainDate> = {
  name: "plainDate",
  compare: (a, b) => Temporal.PlainDate.compare(a, b),
  next: (value) => value.add({ days: 1 }),
  prev: (value) => value.subtract({ days: 1 }),
  measure: (lower, upper) => lower.until(upper, { largestUnit: "day" }).days,
  add: (value, delta) => value.add({ days: Math.trunc(delta) }),
  format: (value) => value.toString(),
  parse: (text) => Temporal.PlainDate.from(text),
};

/** A floating wall date+time — CONTINUOUS; ms `measure`/`add`. */
export const plainDateTimeDomain: IntervalDomain<Temporal.PlainDateTime> = {
  name: "plainDateTime",
  compare: (a, b) => Temporal.PlainDateTime.compare(a, b),
  measure: (lower, upper) =>
    lower.until(upper, { largestUnit: "hour" }).total({ unit: "millisecond" }),
  add: (value, delta) => value.add({ milliseconds: truncMs(delta) }),
  format: (value) => value.toString(),
  parse: (text) => Temporal.PlainDateTime.from(text),
};

/** A wall-clock time — CONTINUOUS; ms `measure`/`add` (wraps within a day). */
export const plainTimeDomain: IntervalDomain<Temporal.PlainTime> = {
  name: "plainTime",
  compare: (a, b) => Temporal.PlainTime.compare(a, b),
  measure: (lower, upper) =>
    lower.until(upper, { largestUnit: "hour" }).total({ unit: "millisecond" }),
  add: (value, delta) => value.add({ milliseconds: truncMs(delta) }),
  format: (value) => value.toString(),
  parse: (text) => Temporal.PlainTime.from(text),
};

// `new`-able classes bound to each Temporal domain; the same-named type alias is
// its instance type, e.g. `new InstantInterval({ start, startClose, end, endClose })`.

/** Interval over `Temporal.Instant` ({@link instantDomain}, continuous, ms). */
export const InstantInterval = defineIntervalType(instantDomain);
/** Instance type of {@link InstantInterval}. */
export type InstantInterval = InstanceType<typeof InstantInterval>;

/** Interval over `Temporal.ZonedDateTime` ({@link zonedDateTimeDomain}, continuous). */
export const ZonedDateTimeInterval = defineIntervalType(zonedDateTimeDomain);
/** Instance type of {@link ZonedDateTimeInterval}. */
export type ZonedDateTimeInterval = InstanceType<typeof ZonedDateTimeInterval>;

/** Interval over `Temporal.PlainDate` ({@link plainDateDomain}, discrete, ε 1 day). */
export const PlainDateInterval = defineIntervalType(plainDateDomain);
/** Instance type of {@link PlainDateInterval}. */
export type PlainDateInterval = InstanceType<typeof PlainDateInterval>;

/** Interval over `Temporal.PlainDateTime` ({@link plainDateTimeDomain}, continuous). */
export const PlainDateTimeInterval = defineIntervalType(plainDateTimeDomain);
/** Instance type of {@link PlainDateTimeInterval}. */
export type PlainDateTimeInterval = InstanceType<typeof PlainDateTimeInterval>;

/** Interval over `Temporal.PlainTime` ({@link plainTimeDomain}, continuous). */
export const PlainTimeInterval = defineIntervalType(plainTimeDomain);
/** Instance type of {@link PlainTimeInterval}. */
export type PlainTimeInterval = InstanceType<typeof PlainTimeInterval>;
