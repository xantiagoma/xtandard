export * from "itty-time";

import { Temporal } from "@js-temporal/polyfill";

import { type DateLike, toInstant } from "./datetime-utils";

/**
 * A duration-like value.
 *
 * - `number` is treated as **milliseconds**
 * - `string` is parsed via `Temporal.Duration.from(...)` (ISO 8601 duration)
 * - `Temporal.Duration` is used as-is
 */
export type DurationLike = number | string | Temporal.Duration;

const hasCalendarUnits = (duration: Temporal.Duration): boolean =>
  duration.years !== 0 || duration.months !== 0 || duration.weeks !== 0 || duration.days !== 0;

/**
 * Convert a duration-like value into a `Temporal.Duration`.
 *
 * @throws {RangeError} If the value is invalid.
 *
 * @example
 * ```ts
 * toDuration(500); // 500ms
 * toDuration("PT2H"); // 2 hours
 * toDuration(Temporal.Duration.from({ minutes: 15 }));
 * ```
 */
export const toDuration = (value: DurationLike): Temporal.Duration => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError("toDuration: invalid milliseconds");
    }

    return Temporal.Duration.from({ milliseconds: value });
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new RangeError("toDuration: invalid duration string");
    }

    return Temporal.Duration.from(trimmed);
  }

  return value;
};

type DurationToMsOptions = {
  /**
   * Reference time for durations that include calendar units (days/weeks/months/years).
   *
   * If omitted and the duration contains calendar units, this function throws because
   * the number of milliseconds is not well-defined without a reference.
   */
  relativeTo?: DateLike;
};

/**
 * Convert a duration-like value into milliseconds.
 *
 * Notes:
 * - Pure time durations (hours/minutes/seconds/...) always work without `relativeTo`.
 * - Durations with calendar units (days/weeks/months/years) require `relativeTo`.
 *
 * @throws {RangeError} If the value is invalid or can't be converted.
 *
 * @example Time-only duration (no relativeTo needed)
 * ```ts
 * durationToMs("PT2H"); // 7200000
 * ```
 *
 * @example Calendar duration (relativeTo required)
 * ```ts
 * durationToMs("P1D", { relativeTo: "2025-01-01T00:00:00Z" }); // 86400000
 * ```
 */
export const durationToMs = (value: DurationLike, options?: DurationToMsOptions): number => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError("durationToMs: invalid milliseconds");
    }
    return value;
  }

  const duration = toDuration(value);

  if (hasCalendarUnits(duration)) {
    const relativeTo = options?.relativeTo;
    if (!relativeTo) {
      throw new RangeError("durationToMs: relativeTo is required for calendar durations");
    }

    const relative = toInstant(relativeTo).toZonedDateTimeISO("UTC");
    const milliseconds = duration.total({
      unit: "milliseconds",
      relativeTo: relative,
    });

    if (!Number.isFinite(milliseconds)) {
      throw new RangeError("durationToMs: invalid duration");
    }

    return milliseconds;
  }

  const milliseconds = duration.total({ unit: "milliseconds" });
  if (!Number.isFinite(milliseconds)) {
    throw new RangeError("durationToMs: invalid duration");
  }

  return milliseconds;
};
