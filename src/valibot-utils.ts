import * as v from "valibot";

import { asTimeZone, isValidTimeZone, type TimeZone } from "./timezone.ts";

/**
 * valibot schema: validate an IANA id and brand it as {@link TimeZone}. Fails
 * with the issue message `"Invalid IANA time zone"`. The value is not
 * canonicalized.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { TimeZoneSchema } from "@xtandard/lib/valibot";
 *
 * const SettingsSchema = v.object({ timeZone: TimeZoneSchema });
 *
 * v.parse(SettingsSchema, { timeZone: "America/New_York" }); // { timeZone: "America/New_York" }
 * v.safeParse(TimeZoneSchema, "Mars/Olympus").issues?.[0].message; // "Invalid IANA time zone"
 * ```
 */
export const TimeZoneSchema = v.pipe(
  v.string(),
  v.check((s) => isValidTimeZone({ timeZone: s }).valid, "Invalid IANA time zone"),
  v.transform(asTimeZone),
);

/**
 * Parse an unknown value as a {@link TimeZone}, throwing when it isn't a valid
 * IANA id. Shorthand for `v.parse(TimeZoneSchema, input)`.
 *
 * @throws {ValiError} When `input` isn't a string or isn't a valid time zone.
 *
 * @example
 * ```ts
 * import { parseTimeZone } from "@xtandard/lib/valibot";
 *
 * parseTimeZone("Europe/Berlin"); // "Europe/Berlin" (TimeZone)
 * parseTimeZone("Mars/Olympus"); // throws ValiError: Invalid IANA time zone
 * ```
 */
export const parseTimeZone = (input: unknown): TimeZone => v.parse(TimeZoneSchema, input);

/** The canonical IANA `TimeZone` brand + its dependency-free check — re-exported
 * from `./timezone` (neither ever needed valibot). */
export { isValidTimeZone, asTimeZone } from "./timezone.ts";
export type { TimeZone } from "./timezone.ts";
