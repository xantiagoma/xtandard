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

/**
 * A precise moment — CONTINUOUS; `measure`/`add` in milliseconds, `compare` is
 * nanosecond-exact. Bound to a class as {@link InstantInterval}.
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { parseInterval } from "@xtandard/lib/interval";
 * import { instantDomain } from "@xtandard/lib/temporal";
 *
 * parseInterval(instantDomain, "[2025-01-01T00:00:00Z,2025-01-02T00:00:00Z)").length(); // 86400000
 * instantDomain.compare(
 *   Temporal.Instant.from("2025-01-01T00:00:00Z"),
 *   Temporal.Instant.from("2025-01-01T00:00:00.000000001Z"),
 * ); // -1 (1ns apart)
 * ```
 */
export const instantDomain: IntervalDomain<Temporal.Instant> = {
  name: "instant",
  compare: (a, b) => Temporal.Instant.compare(a, b),
  measure: (lower, upper) => upper.epochMilliseconds - lower.epochMilliseconds,
  add: (value, delta) => value.add({ milliseconds: truncMs(delta) }),
  format: (value) => value.toString(),
  parse: (text) => Temporal.Instant.from(text),
};

/**
 * A DST-aware zoned moment — CONTINUOUS; ordered by instant (so values in
 * different zones compare correctly); ms `measure`/`add`. Bound to a class as
 * {@link ZonedDateTimeInterval}.
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { zonedDateTimeDomain } from "@xtandard/lib/temporal";
 *
 * zonedDateTimeDomain.compare(
 *   Temporal.ZonedDateTime.from("2025-01-01T12:00[Europe/London]"),
 *   Temporal.ZonedDateTime.from("2025-01-01T07:00[America/New_York]"),
 * ); // 0 (the same instant)
 * ```
 */
export const zonedDateTimeDomain: IntervalDomain<Temporal.ZonedDateTime> = {
  name: "zonedDateTime",
  compare: (a, b) => Temporal.ZonedDateTime.compare(a, b),
  measure: (lower, upper) => upper.epochMilliseconds - lower.epochMilliseconds,
  add: (value, delta) => value.add({ milliseconds: truncMs(delta) }),
  format: (value) => value.toString(),
  parse: (text) => Temporal.ZonedDateTime.from(text),
};

/**
 * A calendar date — DISCRETE (epsilon 1 day); `measure` counts days. Bound to a
 * class as {@link PlainDateInterval}.
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { parseInterval } from "@xtandard/lib/interval";
 * import { plainDateDomain } from "@xtandard/lib/temporal";
 *
 * plainDateDomain.next?.(Temporal.PlainDate.from("2025-02-28")).toString(); // "2025-03-01"
 * parseInterval(plainDateDomain, "[2025-01-01,2025-12-31]").length(); // 365 (days)
 * ```
 */
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

/**
 * A floating wall date+time (no time zone) — CONTINUOUS; ms `measure`/`add`.
 * Bound to a class as {@link PlainDateTimeInterval}.
 *
 * @example
 * ```ts
 * import { parseInterval } from "@xtandard/lib/interval";
 * import { plainDateTimeDomain } from "@xtandard/lib/temporal";
 *
 * const shift = parseInterval(plainDateTimeDomain, "[2025-06-01T09:00,2025-06-01T17:00)");
 * shift.toString(); // "[2025-06-01T09:00:00,2025-06-01T17:00:00)"
 * shift.length(); // 28800000 (8h in ms)
 * ```
 */
export const plainDateTimeDomain: IntervalDomain<Temporal.PlainDateTime> = {
  name: "plainDateTime",
  compare: (a, b) => Temporal.PlainDateTime.compare(a, b),
  measure: (lower, upper) =>
    lower.until(upper, { largestUnit: "hour" }).total({ unit: "millisecond" }),
  add: (value, delta) => value.add({ milliseconds: truncMs(delta) }),
  format: (value) => value.toString(),
  parse: (text) => Temporal.PlainDateTime.from(text),
};

/**
 * A wall-clock time — CONTINUOUS; ms `measure`/`add` (wraps within a day).
 * Bound to a class as {@link PlainTimeInterval}.
 *
 * @example
 * ```ts
 * import { parseInterval } from "@xtandard/lib/interval";
 * import { plainTimeDomain } from "@xtandard/lib/temporal";
 *
 * const hours = parseInterval(plainTimeDomain, "[09:00,17:00)");
 * hours.toString(); // "[09:00:00,17:00:00)"
 * hours.length(); // 28800000 (8h in ms)
 * ```
 */
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

/**
 * Interval over `Temporal.Instant` ({@link instantDomain}, continuous, ms).
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { InstantInterval } from "@xtandard/lib/temporal";
 *
 * const hour = InstantInterval.closedOpen(
 *   Temporal.Instant.from("2025-01-01T00:00:00Z"),
 *   Temporal.Instant.from("2025-01-01T01:00:00Z"),
 * );
 * hour.contains(Temporal.Instant.from("2025-01-01T00:30:00Z")); // true
 * hour.length(); // 3600000 (ms)
 * hour.middle()?.toString(); // "2025-01-01T00:30:00Z"
 * ```
 */
export const InstantInterval = defineIntervalType(instantDomain);
/** Instance type of {@link InstantInterval}. */
export type InstantInterval = InstanceType<typeof InstantInterval>;

/**
 * Interval over `Temporal.ZonedDateTime` ({@link zonedDateTimeDomain}, continuous).
 * DST-aware: `length()` is real elapsed ms, so a spring-forward day is 23 hours.
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { ZonedDateTimeInterval } from "@xtandard/lib/temporal";
 *
 * const day = ZonedDateTimeInterval.closedOpen(
 *   Temporal.ZonedDateTime.from("2025-03-09T00:00[America/New_York]"),
 *   Temporal.ZonedDateTime.from("2025-03-10T00:00[America/New_York]"),
 * );
 * day.length(); // 82800000 (23h: DST starts that day)
 * day.contains(Temporal.ZonedDateTime.from("2025-03-09T12:00[Europe/London]")); // true
 * ```
 */
export const ZonedDateTimeInterval = defineIntervalType(zonedDateTimeDomain);
/** Instance type of {@link ZonedDateTimeInterval}. */
export type ZonedDateTimeInterval = InstanceType<typeof ZonedDateTimeInterval>;

/**
 * Interval over `Temporal.PlainDate` ({@link plainDateDomain}, discrete, ε 1 day).
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { PlainDateInterval } from "@xtandard/lib/temporal";
 *
 * const d = (s: string) => Temporal.PlainDate.from(s);
 * const week = PlainDateInterval.closed(d("2025-03-01"), d("2025-03-07"));
 * week.length(); // 7 (days)
 * week.union(PlainDateInterval.closed(d("2025-03-08"), d("2025-03-14")))?.toString();
 * // "[2025-03-01,2025-03-14]" (adjacent days merge)
 * ```
 */
export const PlainDateInterval = defineIntervalType(plainDateDomain);
/** Instance type of {@link PlainDateInterval}. */
export type PlainDateInterval = InstanceType<typeof PlainDateInterval>;

/**
 * Interval over `Temporal.PlainDateTime` ({@link plainDateTimeDomain}, continuous).
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { PlainDateTimeInterval } from "@xtandard/lib/temporal";
 *
 * const at = (s: string) => Temporal.PlainDateTime.from(s);
 * const shift = PlainDateTimeInterval.closedOpen(at("2025-06-01T09:00"), at("2025-06-01T17:00"));
 * shift.contains(at("2025-06-01T12:30")); // true
 * shift.intersection(PlainDateTimeInterval.closedOpen(at("2025-06-01T16:00"), at("2025-06-01T18:00")))
 *   .toString(); // "[2025-06-01T16:00:00,2025-06-01T17:00:00)"
 * ```
 */
export const PlainDateTimeInterval = defineIntervalType(plainDateTimeDomain);
/** Instance type of {@link PlainDateTimeInterval}. */
export type PlainDateTimeInterval = InstanceType<typeof PlainDateTimeInterval>;

/**
 * Interval over `Temporal.PlainTime` ({@link plainTimeDomain}, continuous).
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { PlainTimeInterval } from "@xtandard/lib/temporal";
 *
 * const t = (s: string) => Temporal.PlainTime.from(s);
 * const open = PlainTimeInterval.closedOpen(t("09:00"), t("17:00"));
 * open.contains(t("17:00")); // false
 * open.difference(PlainTimeInterval.closedOpen(t("12:00"), t("13:00"))).map(String);
 * // ["[09:00:00,12:00:00)", "[13:00:00,17:00:00)"]
 * ```
 */
export const PlainTimeInterval = defineIntervalType(plainTimeDomain);
/** Instance type of {@link PlainTimeInterval}. */
export type PlainTimeInterval = InstanceType<typeof PlainTimeInterval>;
