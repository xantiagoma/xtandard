import { Schema } from "effect";

import { asTimeZone, isValidTimeZone, type TimeZone } from "./timezone.ts";

// Target schema whose Type is the canonical TimeZone brand (Encoded stays string).
const TimeZoneFromSelf = Schema.declare(
  (input: unknown): input is TimeZone => typeof input === "string",
);

/** Effect schema: validate an IANA id and brand it as {@link TimeZone}. */
export const TimeZoneSchema = Schema.transform(
  Schema.String.pipe(
    Schema.filter((s) => isValidTimeZone({ timeZone: s }).valid, {
      message: () => "Invalid IANA time zone",
    }),
  ),
  TimeZoneFromSelf,
  { strict: true, decode: (s) => asTimeZone(s), encode: (tz) => tz },
);

export const parseTimeZone = (input: unknown): TimeZone =>
  Schema.decodeUnknownSync(TimeZoneSchema)(input);

/** The canonical IANA `TimeZone` brand + its dependency-free check. */
export { isValidTimeZone, asTimeZone } from "./timezone.ts";
export type { TimeZone } from "./timezone.ts";
