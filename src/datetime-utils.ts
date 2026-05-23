import { Temporal } from "temporal-polyfill";

import { tryCatchSync } from "./try-catch";

/**
 * Convert a JS `Date` into a `Temporal.Instant`.
 *
 * Prefer this helper over `Temporal.Instant.from(date)` to avoid relying on
 * implementation-defined `Date` parsing/coercion and to get a clearer error
 * on invalid dates.
 *
 * @throws {RangeError} If `date` is an invalid Date.
 *
 * @example
 * ```ts
 * const instant = dateToInstant(new Date("2025-01-01T00:00:00Z"));
 * instant.epochMilliseconds; // number
 * ```
 */
export const dateToInstant = (date: Date): Temporal.Instant => {
  const epochMilliseconds = date.getTime();
  if (!Number.isFinite(epochMilliseconds)) {
    throw new RangeError("dateToInstant: invalid Date");
  }

  return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds);
};

/**
 * Convert a `Temporal.Instant` into a JS `Date`.
 *
 * @throws {RangeError} If the instant is outside the valid JS `Date` range.
 *
 * @example
 * ```ts
 * const date = instantToDate(Temporal.Instant.from("2025-01-01T00:00:00Z"));
 * date.toISOString(); // "2025-01-01T00:00:00.000Z"
 * ```
 */
export const instantToDate = (instant: Temporal.Instant): Date => {
  const epochMilliseconds = instant.epochMilliseconds;

  if (!Number.isFinite(epochMilliseconds)) {
    throw new RangeError("instantToDate: invalid epoch milliseconds");
  }

  const maxDateEpochMs = 8.64e15;
  if (Math.abs(epochMilliseconds) > maxDateEpochMs) {
    throw new RangeError("instantToDate: instant outside JS Date range");
  }

  return new Date(epochMilliseconds);
};

export type DateLike =
  | Date
  | Temporal.Instant
  | Temporal.ZonedDateTime
  | Temporal.PlainDateTime
  | Temporal.PlainDate
  | number
  | string;

/**
 * Convert a variety of date/time-like values into a JS `Date`.
 *
 * Parsing strategy (in order):
 * - `Date` → cloned `Date`
 * - `Temporal.*` instances → converted via UTC epoch milliseconds
 * - `number` → `new Date(number)` (epoch milliseconds)
 * - `string` → try `Temporal.ZonedDateTime`, `Temporal.Instant`, `Temporal.PlainDateTime`, `Temporal.PlainDate`
 *   (all interpreted as UTC where needed), then fall back to `new Date(string)`
 *
 * @throws {RangeError} If the value is invalid or out of JS `Date` range.
 *
 * @example
 * ```ts
 * toDate(new Date());
 * toDate(Temporal.Instant.from("2025-01-01T00:00:00Z"));
 * toDate(Temporal.ZonedDateTime.from("2025-01-01T00:00[UTC]"));
 * toDate(1735689600000); // epoch ms
 * toDate("2025-01-01T00:00:00Z");
 * toDate("2025-01-01"); // interpreted as 00:00:00Z
 * ```
 */
export const toDate = (value: DateLike): Date => {
  if (value instanceof Date) {
    return new Date(dateToInstant(value).epochMilliseconds);
  }

  if (value instanceof Temporal.Instant) {
    return instantToDate(value);
  }

  if (value instanceof Temporal.ZonedDateTime) {
    return instantToDate(value.toInstant());
  }

  if (value instanceof Temporal.PlainDateTime) {
    return instantToDate(value.toZonedDateTime("UTC").toInstant());
  }

  if (value instanceof Temporal.PlainDate) {
    return instantToDate(value.toZonedDateTime("UTC").toInstant());
  }

  if (typeof value === "number") {
    const date = new Date(value);
    const epochMilliseconds = date.getTime();
    if (!Number.isFinite(epochMilliseconds)) {
      throw new RangeError("toDate: invalid epoch milliseconds");
    }
    return date;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new RangeError("toDate: invalid date string");
  }

  const temporalParsers = [
    (input: string) => Temporal.ZonedDateTime.from(input).toInstant(),
    (input: string) => Temporal.Instant.from(input),
    (input: string) => Temporal.PlainDateTime.from(input).toZonedDateTime("UTC").toInstant(),
    (input: string) => Temporal.PlainDate.from(input).toZonedDateTime("UTC").toInstant(),
  ] as const;

  let temporalParsed: Temporal.Instant | null = null;
  for (const parse of temporalParsers) {
    const [instant] = tryCatchSync(() => parse(trimmed));
    if (instant) {
      temporalParsed = instant;
      break;
    }
  }

  if (temporalParsed) {
    return instantToDate(temporalParsed);
  }

  const date = new Date(trimmed);
  const epochMilliseconds = date.getTime();
  if (!Number.isFinite(epochMilliseconds)) {
    throw new RangeError("toDate: invalid date string");
  }

  return date;
};

/**
 * Convert a variety of date/time-like values into a `Temporal.Instant`.
 *
 * Parsing strategy (in order):
 * - `Temporal.Instant` → returned as-is
 * - `Temporal.ZonedDateTime` → `.toInstant()`
 * - `Temporal.PlainDateTime` / `Temporal.PlainDate` → interpreted as UTC
 * - `Date` → epoch milliseconds
 * - `number` → epoch milliseconds
 * - `string` → try Temporal parsers, then `new Date(string)` as a last resort
 *
 * @throws {RangeError} If the value is invalid or can't be parsed.
 *
 * @example
 * ```ts
 * toInstant(new Date("2025-01-01T00:00:00Z"));
 * toInstant(Temporal.ZonedDateTime.from("2025-01-01T00:00[UTC]"));
 * toInstant(1735689600000); // epoch ms
 * toInstant("2025-01-01T00:00:00Z");
 * ```
 */
export const toInstant = (value: DateLike): Temporal.Instant => {
  if (value instanceof Temporal.Instant) {
    return value;
  }

  if (value instanceof Temporal.ZonedDateTime) {
    return value.toInstant();
  }

  if (value instanceof Temporal.PlainDateTime) {
    return value.toZonedDateTime("UTC").toInstant();
  }

  if (value instanceof Temporal.PlainDate) {
    return value.toZonedDateTime("UTC").toInstant();
  }

  if (value instanceof Date) {
    return dateToInstant(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError("toInstant: invalid epoch milliseconds");
    }

    return Temporal.Instant.fromEpochMilliseconds(value);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new RangeError("toInstant: invalid date string");
  }

  const temporalParsers = [
    (input: string) => Temporal.ZonedDateTime.from(input).toInstant(),
    (input: string) => Temporal.Instant.from(input),
    (input: string) => Temporal.PlainDateTime.from(input).toZonedDateTime("UTC").toInstant(),
    (input: string) => Temporal.PlainDate.from(input).toZonedDateTime("UTC").toInstant(),
  ] as const;

  for (const parse of temporalParsers) {
    const [instant] = tryCatchSync(() => parse(trimmed));
    if (instant) {
      return instant;
    }
  }

  const date = new Date(trimmed);
  const epochMilliseconds = date.getTime();
  if (!Number.isFinite(epochMilliseconds)) {
    throw new RangeError("toInstant: invalid date string");
  }

  return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds);
};
