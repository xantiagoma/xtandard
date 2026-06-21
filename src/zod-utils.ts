import { z } from "zod";

import { asTimeZone, isValidTimeZone, type TimeZone } from "./timezone.ts";

/** Zod schema: validate an IANA id and brand it as {@link TimeZone}. */
export const TimeZoneSchema = z
  .string()
  .refine((s) => isValidTimeZone({ timeZone: s }).valid, { message: "Invalid IANA time zone" })
  .transform(asTimeZone);

export const parseTimeZone = (input: unknown): TimeZone => TimeZoneSchema.parse(input);

/** The canonical IANA `TimeZone` brand + its dependency-free check. */
export { isValidTimeZone, asTimeZone } from "./timezone.ts";
export type { TimeZone } from "./timezone.ts";
