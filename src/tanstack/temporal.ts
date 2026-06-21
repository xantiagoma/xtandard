/**
 * URL parsers for the six temporal "kinds". Each stores the value as its
 * canonical Temporal string and parses back to the live `Temporal.*` object —
 * the same model the rest of an app holds in state.
 *
 * Opt-in subpath (`xtandard/tanstack/temporal`): only this entry pulls in
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

/** A precise moment on the global timeline — ISO-8601 UTC (`2026-06-18T16:00:00Z`). */
export const parseAsInstant: Parser<Temporal.Instant> = temporalParser({
  from: (value) => Temporal.Instant.from(value),
  eq: (a, b) => a.equals(b),
});

/** A calendar date, no time, no zone (`2026-12-25`). */
export const parseAsPlainDate: Parser<Temporal.PlainDate> = temporalParser({
  from: (value) => Temporal.PlainDate.from(value),
  eq: (a, b) => a.equals(b),
});

/** A wall-clock time, no date, no zone (`09:00:00`). */
export const parseAsPlainTime: Parser<Temporal.PlainTime> = temporalParser({
  from: (value) => Temporal.PlainTime.from(value),
  eq: (a, b) => a.equals(b),
});

/** A floating wall date+time, no zone (`2026-12-25T09:00:00`). */
export const parseAsPlainDateTime: Parser<Temporal.PlainDateTime> = temporalParser({
  from: (value) => Temporal.PlainDateTime.from(value),
  eq: (a, b) => a.equals(b),
});

/** A DST-aware wall date/time bound to an IANA zone
 * (`2026-06-18T09:00:00-07:00[America/Los_Angeles]`). */
export const parseAsZonedDateTime: Parser<Temporal.ZonedDateTime> = temporalParser({
  from: (value) => Temporal.ZonedDateTime.from(value),
  eq: (a, b) => a.equals(b),
});

/** A length of time — ISO-8601 duration (`PT30M`, `P1DT2H`). Compared by
 * canonical string (Temporal.Duration has no `equals`, and a relative-to-free
 * compare throws on calendar units). */
export const parseAsDuration: Parser<Temporal.Duration> = temporalParser({
  from: (value) => Temporal.Duration.from(value),
  eq: (a, b) => a.toString() === b.toString(),
});

/** An IANA timezone id (`America/Los_Angeles`, `UTC`), validated via the
 * `xtandard/valibot` TimeZone schema. Returned as the branded `TimeZone`
 * string; an unknown id parses to `null`. Not a Temporal kind, but it travels
 * with them. */
export const parseAsTimeZone: Parser<TimeZone> = temporalParser({
  from: (value) => parseTimeZone(value),
  eq: (a, b) => a === b,
});
