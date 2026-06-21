/**
 * Valibot schemas for the temporal "kinds" — each accepts a string, validates it
 * through the matching `Temporal.*.from` constructor, and normalizes the output
 * to the canonical string form. Invalid strings raise a valibot issue (typed
 * rejection at the boundary) instead of throwing.
 *
 * Peers: `valibot` + `@js-temporal/polyfill` (both optional). Exposed from
 * `xantiagoma/valibot`.
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

/** ISO-8601 instant with offset or `Z` (`2026-06-18T16:00:00Z`). */
export const InstantSchema = temporalStringSchema({
  from: (value) => Temporal.Instant.from(value),
  message: "Invalid instant (expected ISO-8601 with offset or Z)",
});

/** Calendar date `YYYY-MM-DD`. */
export const PlainDateSchema = temporalStringSchema({
  from: (value) => Temporal.PlainDate.from(value),
  message: "Invalid plain date (expected YYYY-MM-DD)",
});

/** Wall-clock time `HH:MM[:SS]`. */
export const PlainTimeSchema = temporalStringSchema({
  from: (value) => Temporal.PlainTime.from(value),
  message: "Invalid plain time (expected HH:MM[:SS])",
});

/** Floating wall date+time `YYYY-MM-DDTHH:MM[:SS]`. */
export const PlainDateTimeSchema = temporalStringSchema({
  from: (value) => Temporal.PlainDateTime.from(value),
  message: "Invalid plain date-time (expected YYYY-MM-DDTHH:MM[:SS])",
});

/** Zoned date-time `…[Area/Location]`. */
export const ZonedDateTimeSchema = temporalStringSchema({
  from: (value) => Temporal.ZonedDateTime.from(value),
  message: "Invalid zoned date-time (expected ...[Area/Location])",
});

/** ISO-8601 duration (`PT30M`, `P1DT2H`). */
export const DurationSchema = temporalStringSchema({
  from: (value) => Temporal.Duration.from(value),
  message: "Invalid duration (expected ISO-8601 like PT30M)",
});
