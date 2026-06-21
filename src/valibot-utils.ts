import * as v from "valibot";

export const TimeZoneSchema = v.pipe(
  v.string(),
  v.transform((s) => {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: s });
      return s;
    } catch {
      throw new TypeError("Invalid IANA time zone");
    }
  }),
  v.brand("TimeZone"),
);

export type TimeZone = v.InferOutput<typeof TimeZoneSchema>;

export const parseTimeZone = (input: unknown): TimeZone => v.parse(TimeZoneSchema, input);

/** Whether a string is a valid IANA timezone id (checked via `Intl`). */
export function isValidTimeZone(input: { timeZone: string }): { valid: boolean } {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: input.timeZone });

    return { valid: true };
  } catch {
    return { valid: false };
  }
}
