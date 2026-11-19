import { z } from "zod";

import { asTimeZone, isValidTimeZone, type TimeZone } from "./timezone.ts";

/**
 * Zod schema: validate an IANA id and brand it as {@link TimeZone}. Fails with
 * the issue message `"Invalid IANA time zone"`. The value is not canonicalized.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { TimeZoneSchema } from "@xtandard/lib/zod";
 *
 * const SettingsSchema = z.object({ timeZone: TimeZoneSchema });
 *
 * SettingsSchema.parse({ timeZone: "Asia/Tokyo" }); // { timeZone: "Asia/Tokyo" }
 * TimeZoneSchema.safeParse("Mars/Olympus").error?.issues[0]?.message; // "Invalid IANA time zone"
 * ```
 */
export const TimeZoneSchema = z
  .string()
  .refine((s) => isValidTimeZone({ timeZone: s }).valid, { message: "Invalid IANA time zone" })
  .transform(asTimeZone);

/**
 * Parse an unknown value as a {@link TimeZone}, throwing when it isn't a valid
 * IANA id. Shorthand for `TimeZoneSchema.parse(input)`.
 *
 * @throws {ZodError} When `input` isn't a string or isn't a valid time zone.
 *
 * @example
 * ```ts
 * import { parseTimeZone } from "@xtandard/lib/zod";
 *
 * parseTimeZone("UTC"); // "UTC" (TimeZone)
 * parseTimeZone("Mars/Olympus"); // throws ZodError (message "Invalid IANA time zone")
 * ```
 */
export const parseTimeZone = (input: unknown): TimeZone => TimeZoneSchema.parse(input);

/** The canonical IANA `TimeZone` brand + its dependency-free check. */
export { isValidTimeZone, asTimeZone } from "./timezone.ts";
export type { TimeZone } from "./timezone.ts";
