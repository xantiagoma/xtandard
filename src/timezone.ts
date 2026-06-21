/**
 * The canonical **`TimeZone`** brand and its IANA validity check — pure and
 * dependency-free (just `Intl` in a `tryCatch`). Every validator's
 * `TimeZoneSchema` (`@xtandard/lib/{valibot,zod,arktype,effect}`) validates into
 * this SAME nominal type, so a `TimeZone` from one validator is a `TimeZone`
 * everywhere.
 */

import { tryCatch } from "./try-catch.ts";

declare const timeZoneBrand: unique symbol;

/** An IANA time-zone id, validated via `Intl` — a nominal brand over `string`
 * shared by every validator's `TimeZoneSchema`. */
export type TimeZone = string & { readonly [timeZoneBrand]: "TimeZone" };

/** Whether `timeZone` is a valid IANA id (constructing `Intl.DateTimeFormat`
 * throws for unknown zones). */
export function isValidTimeZone(input: { timeZone: string }): { valid: boolean } {
  const [, error] = tryCatch(() => Intl.DateTimeFormat("en-US", { timeZone: input.timeZone }));

  return { valid: error === null };
}

/** Brand a string as a {@link TimeZone}. The one tolerated cast: a brand
 * constructor — the caller guarantees the string was validated first (every
 * `TimeZoneSchema` runs {@link isValidTimeZone} before calling this). */
export const asTimeZone = (value: string): TimeZone => value as TimeZone;
