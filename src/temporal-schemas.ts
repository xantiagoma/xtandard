/**
 * Valibot schemas for the temporal "kinds" — each accepts a string, validates it
 * through the matching `Temporal.*.from` constructor, and normalizes the output
 * to the canonical string form. Invalid strings raise a valibot issue (typed
 * rejection at the boundary) instead of throwing.
 *
 * Peers: `valibot` + `@js-temporal/polyfill` (both optional). Exposed from
 * `@xtandard/lib/valibot`.
 */

import { Temporal } from "@js-temporal/polyfill";
import * as v from "valibot";

function temporalStringSchema(input: {
  from: (value: string) => { toString: () => string };
  message: string;
}): v.GenericSchema<string, string> {
  const { from, message } = input;

  return v.pipe(
    v.string(),
    v.rawTransform(({ dataset, addIssue, NEVER }) => {
      try {
        return from(dataset.value).toString();
      } catch {
        addIssue({ message });

        return NEVER;
      }
    }),
  );
}

/**
 * valibot schema for an ISO-8601 instant with an offset or `Z`
 * (`2026-06-18T16:00:00Z`). Validated with `Temporal.Instant.from` and
 * normalized to UTC `Z` form. Output is a string, not a `Temporal.Instant`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { InstantSchema } from "@xtandard/lib/valibot";
 *
 * v.parse(InstantSchema, "2026-06-18T18:00:00+02:00"); // "2026-06-18T16:00:00Z"
 * v.safeParse(InstantSchema, "2026-06-18T18:00:00").issues?.[0].message;
 * // "Invalid instant (expected ISO-8601 with offset or Z)": no offset
 * ```
 */
export const InstantSchema = temporalStringSchema({
  from: (value) => Temporal.Instant.from(value),
  message: "Invalid instant (expected ISO-8601 with offset or Z)",
});

/**
 * valibot schema for a calendar date `YYYY-MM-DD`. Validated with
 * `Temporal.PlainDate.from` (so impossible dates fail) and normalized to the
 * canonical string. Output is a string, not a `Temporal.PlainDate`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { PlainDateSchema } from "@xtandard/lib/valibot";
 *
 * v.parse(PlainDateSchema, "2026-12-25"); // "2026-12-25"
 * v.parse(PlainDateSchema, "2026-12-25T09:00"); // "2026-12-25" (time dropped)
 * v.safeParse(PlainDateSchema, "2026-02-30").issues?.[0].message;
 * // "Invalid plain date (expected YYYY-MM-DD)"
 * ```
 */
export const PlainDateSchema = temporalStringSchema({
  from: (value) => Temporal.PlainDate.from(value),
  message: "Invalid plain date (expected YYYY-MM-DD)",
});

/**
 * valibot schema for a wall-clock time `HH:MM[:SS]`. Validated with
 * `Temporal.PlainTime.from` and normalized to the canonical string (seconds
 * always present). Output is a string, not a `Temporal.PlainTime`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { PlainTimeSchema } from "@xtandard/lib/valibot";
 *
 * v.parse(PlainTimeSchema, "09:00"); // "09:00:00"
 * v.safeParse(PlainTimeSchema, "25:00").issues?.[0].message;
 * // "Invalid plain time (expected HH:MM[:SS])"
 * ```
 */
export const PlainTimeSchema = temporalStringSchema({
  from: (value) => Temporal.PlainTime.from(value),
  message: "Invalid plain time (expected HH:MM[:SS])",
});

/**
 * valibot schema for a floating wall date+time `YYYY-MM-DDTHH:MM[:SS]` (no
 * zone). Validated with `Temporal.PlainDateTime.from` and normalized to the
 * canonical string. Output is a string, not a `Temporal.PlainDateTime`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { PlainDateTimeSchema } from "@xtandard/lib/valibot";
 *
 * v.parse(PlainDateTimeSchema, "2026-12-25T09:00"); // "2026-12-25T09:00:00"
 * v.parse(PlainDateTimeSchema, "2026-12-25"); // "2026-12-25T00:00:00"
 * v.safeParse(PlainDateTimeSchema, "tomorrow").issues?.[0].message;
 * // "Invalid plain date-time (expected YYYY-MM-DDTHH:MM[:SS])"
 * ```
 */
export const PlainDateTimeSchema = temporalStringSchema({
  from: (value) => Temporal.PlainDateTime.from(value),
  message: "Invalid plain date-time (expected YYYY-MM-DDTHH:MM[:SS])",
});

/**
 * valibot schema for a zoned date-time with a bracketed IANA zone
 * (`2026-06-18T09:00-07:00[America/Los_Angeles]`). Validated with
 * `Temporal.ZonedDateTime.from` and normalized to the canonical string (the
 * offset is filled in). Output is a string, not a `Temporal.ZonedDateTime`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { ZonedDateTimeSchema } from "@xtandard/lib/valibot";
 *
 * v.parse(ZonedDateTimeSchema, "2026-06-18T09:00[Europe/Paris]");
 * // "2026-06-18T09:00:00+02:00[Europe/Paris]"
 * v.safeParse(ZonedDateTimeSchema, "2026-06-18T09:00-07:00").issues?.[0].message;
 * // "Invalid zoned date-time (expected ...[Area/Location])": no bracketed zone
 * ```
 */
export const ZonedDateTimeSchema = temporalStringSchema({
  from: (value) => Temporal.ZonedDateTime.from(value),
  message: "Invalid zoned date-time (expected ...[Area/Location])",
});

/**
 * valibot schema for an ISO-8601 duration (`PT30M`, `P1DT2H`). Validated with
 * `Temporal.Duration.from` and normalized to the canonical string. Output is a
 * string, not a `Temporal.Duration`.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { DurationSchema } from "@xtandard/lib/valibot";
 *
 * const MeetingSchema = v.object({ length: DurationSchema });
 *
 * v.parse(MeetingSchema, { length: "PT90M" }); // { length: "PT90M" }
 * v.safeParse(DurationSchema, "15 minutes").issues?.[0].message;
 * // "Invalid duration (expected ISO-8601 like PT30M)"
 * ```
 */
export const DurationSchema = temporalStringSchema({
  from: (value) => Temporal.Duration.from(value),
  message: "Invalid duration (expected ISO-8601 like PT30M)",
});
