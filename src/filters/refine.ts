/**
 * Validator-free runtime predicates shared by the non-valibot ready-made schema
 * subpaths (`./schemas-zod`, `./schemas-arktype`, `./schemas-effect`). They keep
 * those schemas at PARITY with the valibot ones — `timeZone` is a real IANA id
 * and `anchor`/`end` are valid `Temporal.PlainDateTime` strings — without pulling
 * a validation library into the bundle. Peer: `@js-temporal/polyfill` (optional,
 * same as the valibot temporal schemas). These do not change any output type.
 */

import { Temporal } from "@js-temporal/polyfill";

import { tryCatch } from "../try-catch.ts";
import { isValidTimeZone } from "../timezone.ts";

/** Whether `value` is a valid IANA time-zone id (the shared dependency-free
 * check — `(string) => boolean` for use as a refine/filter/narrow callback). */
export const isIanaTimeZone = (value: string): boolean =>
  isValidTimeZone({ timeZone: value }).valid;

/** Whether `value` is a valid floating `Temporal.PlainDateTime` string. */
export const isPlainDateTimeString = (value: string): boolean =>
  tryCatch(() => Temporal.PlainDateTime.from(value))[1] === null;

/** The ten `DateUnit` literals, as a runtime tuple (the type-only `DateUnit`
 * lives in `./types`). Reused by every ready-made schema. */
export const DATE_UNITS = [
  "millisecond",
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "halfYear",
  "year",
] as const;
