import * as v from "valibot";

import { asTimeZone, isValidTimeZone, type TimeZone } from "./timezone.ts";

/** valibot schema: validate an IANA id and brand it as {@link TimeZone}. */
export const TimeZoneSchema = v.pipe(
  v.string(),
  v.check((s) => isValidTimeZone({ timeZone: s }).valid, "Invalid IANA time zone"),
  v.transform(asTimeZone),
);

export const parseTimeZone = (input: unknown): TimeZone => v.parse(TimeZoneSchema, input);

/** The canonical IANA `TimeZone` brand + its dependency-free check — re-exported
 * from `./timezone` (neither ever needed valibot). */
export { isValidTimeZone, asTimeZone } from "./timezone.ts";
export type { TimeZone } from "./timezone.ts";
