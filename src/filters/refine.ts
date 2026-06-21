/**
 * Validator-free runtime predicates shared by the non-valibot ready-made schema
 * subpaths (`./schemas-zod`, `./schemas-arktype`, `./schemas-effect`). They keep
 * those schemas at PARITY with the valibot ones — `timeZone` is a real IANA id
 * and `anchor`/`end` are valid `Temporal.PlainDateTime` strings — without pulling
 * a validation library into the bundle. Peer: `@js-temporal/polyfill` (optional,
 * same as the valibot temporal schemas). These do not change any output type.
 */

import { Temporal } from "@js-temporal/polyfill";

/** Whether `value` is a valid IANA time-zone id (checked via `Intl`). */
export function isIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });

    return true;
  } catch {
    return false;
  }
}

/** Whether `value` is a valid floating `Temporal.PlainDateTime` string. */
export function isPlainDateTimeString(value: string): boolean {
  try {
    Temporal.PlainDateTime.from(value);

    return true;
  } catch {
    return false;
  }
}

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
