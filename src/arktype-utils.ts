import { type } from "arktype";

import { asTimeZone, isValidTimeZone, type TimeZone } from "./timezone.ts";

/** ArkType schema: validate an IANA id and brand it as {@link TimeZone}. */
export const TimeZoneSchema = type.string
  .narrow((s) => isValidTimeZone({ timeZone: s }).valid)
  .pipe(asTimeZone);

export const parseTimeZone = (input: unknown): TimeZone => TimeZoneSchema.assert(input);

/** The canonical IANA `TimeZone` brand + its dependency-free check. */
export { isValidTimeZone, asTimeZone } from "./timezone.ts";
export type { TimeZone } from "./timezone.ts";
