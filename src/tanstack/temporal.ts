/**
 * URL parsers for the six temporal "kinds". Each stores the value as its
 * canonical Temporal string and parses back to the live `Temporal.*` object —
 * the same model the rest of an app holds in state.
 *
 * Opt-in subpath (`@xtandard/lib/tanstack/temporal`): only this entry pulls in
 * `@js-temporal/polyfill`, so the core stays dependency-free.
 *
 * `Temporal` is imported from `@js-temporal/polyfill` (the spec-reference impl;
 * the same one `@gobrand/tiempo` / `@gobrand/react-calendar` bundle). NEVER mix
 * in another polyfill, or `instanceof Temporal.*` checks break silently.
 */

import { Temporal } from "@js-temporal/polyfill";

import { parseTimeZone, type TimeZone } from "../valibot-utils.ts";
import { createParser, type Parser } from "./core/parser.ts";

function temporalParser<T extends { toString: () => string }>(input: {
  from: (value: string) => T;
  eq: (a: T, b: T) => boolean;
}): Parser<T> {
  const { from, eq } = input;

  return createParser({
    parse: (value) => {
      try {
        return from(value);
      } catch {
        return null;
      }
    },
    serialize: (value) => value.toString(),
    eq,
  });
}

/**
 * A precise moment on the global timeline — ISO-8601 UTC (`2026-06-18T16:00:00Z`).
 * An input with an offset is accepted and normalized to UTC; one without an
 * offset or `Z` parses to `null`.
 *
 * @example
 * ```ts
 * import { useQueryState } from "@xtandard/lib/tanstack";
 * import { parseAsInstant } from "@xtandard/lib/tanstack/temporal";
 *
 * parseAsInstant.parse("2026-06-18T09:00:00-07:00")?.toString(); // → "2026-06-18T16:00:00Z"
 * parseAsInstant.parse("2026-06-18"); // → null (no offset)
 *
 * const [at, setAt] = useQueryState("at", parseAsInstant);
 * ```
 */
export const parseAsInstant: Parser<Temporal.Instant> = temporalParser({
  from: (value) => Temporal.Instant.from(value),
  eq: (a, b) => a.equals(b),
});

/**
 * A calendar date, no time, no zone (`2026-12-25`). An invalid date parses to `null`.
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { parseAsPlainDate } from "@xtandard/lib/tanstack/temporal";
 *
 * parseAsPlainDate.parse("2026-12-25")?.dayOfWeek; // → 5 (Friday)
 * parseAsPlainDate.parse("2026-13-01"); // → null
 *
 * const day = parseAsPlainDate.withDefault(Temporal.PlainDate.from("2026-01-01"));
 * ```
 */
export const parseAsPlainDate: Parser<Temporal.PlainDate> = temporalParser({
  from: (value) => Temporal.PlainDate.from(value),
  eq: (a, b) => a.equals(b),
});

/**
 * A wall-clock time, no date, no zone (`09:00:00`). Serializes with seconds.
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { parseAsPlainTime } from "@xtandard/lib/tanstack/temporal";
 *
 * parseAsPlainTime.parse("09:00")?.toString(); // → "09:00:00"
 * parseAsPlainTime.serialize(Temporal.PlainTime.from({ hour: 17, minute: 30 })); // → "17:30:00"
 * ```
 */
export const parseAsPlainTime: Parser<Temporal.PlainTime> = temporalParser({
  from: (value) => Temporal.PlainTime.from(value),
  eq: (a, b) => a.equals(b),
});

/**
 * A floating wall date+time, no zone (`2026-12-25T09:00:00`).
 *
 * @example
 * ```ts
 * import { parseAsPlainDateTime } from "@xtandard/lib/tanstack/temporal";
 *
 * parseAsPlainDateTime.parse("2026-12-25T09:00")?.toString(); // → "2026-12-25T09:00:00"
 * parseAsPlainDateTime.parse("tomorrow"); // → null
 * ```
 */
export const parseAsPlainDateTime: Parser<Temporal.PlainDateTime> = temporalParser({
  from: (value) => Temporal.PlainDateTime.from(value),
  eq: (a, b) => a.equals(b),
});

/**
 * A DST-aware wall date/time bound to an IANA zone
 * (`2026-06-18T09:00:00-07:00[America/Los_Angeles]`). The `[zone]` annotation
 * is required; without it the value parses to `null`.
 *
 * @example
 * ```ts
 * import { parseAsZonedDateTime } from "@xtandard/lib/tanstack/temporal";
 *
 * const meeting = parseAsZonedDateTime.parse("2026-06-18T09:00:00-07:00[America/Los_Angeles]");
 * meeting?.timeZoneId; // → "America/Los_Angeles"
 * parseAsZonedDateTime.parse("2026-06-18T09:00:00-07:00"); // → null (no zone)
 * ```
 */
export const parseAsZonedDateTime: Parser<Temporal.ZonedDateTime> = temporalParser({
  from: (value) => Temporal.ZonedDateTime.from(value),
  eq: (a, b) => a.equals(b),
});

const calendarUnits = ["years", "months", "weeks"] as const;

/**
 * Equal lengths of time. `Temporal.Duration.compare` needs a `relativeTo`
 * date once years, months or weeks are involved (a month has no fixed
 * length), so those units must match field by field; the rest (days as 24 h,
 * hours … nanoseconds) is compared by total length.
 */
function durationEquals(a: Temporal.Duration, b: Temporal.Duration): boolean {
  if (calendarUnits.some((unit) => a[unit] !== b[unit])) return false;
  const timePart = (d: Temporal.Duration): Temporal.Duration =>
    d.with({ years: 0, months: 0, weeks: 0 });
  return Temporal.Duration.compare(timePart(a), timePart(b)) === 0;
}

/**
 * A length of time — ISO-8601 duration (`PT30M`, `P1DT2H`). Equality is by
 * length, not spelling: `PT90M` equals `PT1H30M`, and `P1D` equals `PT24H`
 * (a day is 24 h, as in `Temporal.Duration.compare` without `relativeTo`).
 * Years, months and weeks have no fixed length, so they must match exactly:
 * `P1M` ≠ `P30D`, `P1Y` ≠ `P12M`, `P1W` ≠ `P7D`.
 *
 * @example
 * ```ts
 * import { Temporal } from "@js-temporal/polyfill";
 * import { parseAsDuration } from "@xtandard/lib/tanstack/temporal";
 *
 * parseAsDuration.parse("PT90M")?.total("minutes"); // → 90
 * parseAsDuration.serialize(Temporal.Duration.from({ hours: 1, minutes: 30 })); // → "PT1H30M"
 * parseAsDuration.parse("90 minutes"); // → null
 * parseAsDuration.eq(Temporal.Duration.from("PT90M"), Temporal.Duration.from("PT1H30M")); // → true
 * ```
 */
export const parseAsDuration: Parser<Temporal.Duration> = temporalParser({
  from: (value) => Temporal.Duration.from(value),
  eq: durationEquals,
});

/**
 * An IANA timezone id (`America/Los_Angeles`, `UTC`), validated via the
 * `@xtandard/lib/valibot` TimeZone schema. Returned as the branded `TimeZone`
 * string; an unknown id parses to `null`. Not a Temporal kind, but it travels
 * with them.
 *
 * @example
 * ```ts
 * import { useQueryState } from "@xtandard/lib/tanstack";
 * import { parseAsTimeZone } from "@xtandard/lib/tanstack/temporal";
 * import { asTimeZone } from "@xtandard/lib/valibot";
 *
 * parseAsTimeZone.parse("America/Los_Angeles"); // → "America/Los_Angeles"
 * parseAsTimeZone.parse("Nope/Zone"); // → null
 *
 * const [tz, setTz] = useQueryState("tz", parseAsTimeZone.withDefault(asTimeZone("UTC")));
 * ```
 */
export const parseAsTimeZone: Parser<TimeZone> = temporalParser({
  from: (value) => parseTimeZone(value),
  eq: (a, b) => a === b,
});
