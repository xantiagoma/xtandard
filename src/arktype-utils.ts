import { type } from "arktype";

import { asTimeZone, isValidTimeZone, type TimeZone } from "./timezone.ts";

/**
 * ArkType schema: validate an IANA id and brand it as {@link TimeZone}. The
 * value is not canonicalized. It has no custom message, so failures read
 * "must be valid according to an anonymous predicate".
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { TimeZoneSchema } from "@xtandard/lib/arktype";
 *
 * TimeZoneSchema("Asia/Tokyo"); // "Asia/Tokyo" (TimeZone)
 *
 * const out = TimeZoneSchema("Mars/Olympus");
 * if (out instanceof type.errors) {
 *   out.summary; // 'must be valid according to an anonymous predicate (was "Mars/Olympus")'
 * }
 * ```
 */
export const TimeZoneSchema = type.string
  .narrow((s) => isValidTimeZone({ timeZone: s }).valid)
  .pipe(asTimeZone);

/**
 * Parse an unknown value as a {@link TimeZone}, throwing when it isn't a valid
 * IANA id. Shorthand for `TimeZoneSchema.assert(input)`.
 *
 * @throws {TraversalError} When `input` isn't a string or isn't a valid time zone.
 *
 * @example
 * ```ts
 * import { parseTimeZone } from "@xtandard/lib/arktype";
 *
 * parseTimeZone("Asia/Tokyo"); // "Asia/Tokyo" (TimeZone)
 * parseTimeZone("Mars/Olympus");
 * // throws TraversalError: must be valid according to an anonymous predicate (was "Mars/Olympus")
 * ```
 */
export const parseTimeZone = (input: unknown): TimeZone => TimeZoneSchema.assert(input);

/** The canonical IANA `TimeZone` brand + its dependency-free check. */
export { isValidTimeZone, asTimeZone } from "./timezone.ts";
export type { TimeZone } from "./timezone.ts";
