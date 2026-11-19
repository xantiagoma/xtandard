import { Schema } from "effect";

import { asTimeZone, isValidTimeZone, type TimeZone } from "./timezone.ts";

// Target schema whose Type is the canonical TimeZone brand (Encoded stays string).
const TimeZoneFromSelf = Schema.declare(
  (input: unknown): input is TimeZone => typeof input === "string",
);

/**
 * Effect schema: validate an IANA id and brand it as {@link TimeZone}. Fails
 * with the message `"Invalid IANA time zone"`. The value is not canonicalized.
 * It is a two-way transformation: the encoded side is a plain `string`, so
 * `Schema.encodeSync` gives the string back.
 *
 * @example
 * ```ts
 * import { Either, Schema } from "effect";
 * import { TimeZoneSchema } from "@xtandard/lib/effect";
 *
 * const Settings = Schema.Struct({ timeZone: TimeZoneSchema });
 *
 * Schema.decodeUnknownSync(Settings)({ timeZone: "Europe/Berlin" }); // { timeZone: "Europe/Berlin" }
 * Either.isLeft(Schema.decodeUnknownEither(TimeZoneSchema)("Mars/Olympus")); // true
 * ```
 */
export const TimeZoneSchema = Schema.transform(
  Schema.String.pipe(
    Schema.filter((s) => isValidTimeZone({ timeZone: s }).valid, {
      message: () => "Invalid IANA time zone",
    }),
  ),
  TimeZoneFromSelf,
  { strict: true, decode: (s) => asTimeZone(s), encode: (tz) => tz },
);

/**
 * Parse an unknown value as a {@link TimeZone}, throwing when it isn't a valid
 * IANA id. Shorthand for `Schema.decodeUnknownSync(TimeZoneSchema)(input)`.
 *
 * @throws {ParseError} When `input` isn't a string or isn't a valid time zone.
 *
 * @example
 * ```ts
 * import { parseTimeZone } from "@xtandard/lib/effect";
 *
 * parseTimeZone("Europe/Berlin"); // "Europe/Berlin" (TimeZone)
 * parseTimeZone("Mars/Olympus"); // throws ParseError (message includes "Invalid IANA time zone")
 * ```
 */
export const parseTimeZone = (input: unknown): TimeZone =>
  Schema.decodeUnknownSync(TimeZoneSchema)(input);

/** The canonical IANA `TimeZone` brand + its dependency-free check. */
export { isValidTimeZone, asTimeZone } from "./timezone.ts";
export type { TimeZone } from "./timezone.ts";
