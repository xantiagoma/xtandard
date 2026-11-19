import { ulid as _ulid, decodeTime } from "ulid";

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const isValid = (id: string): boolean => ULID_REGEX.test(id);

import { valueOrThrow } from "./error";

/**
 * Generates a ULID, optionally with a Stripe-style type prefix (`usr_01jd…`).
 *
 * With a prefix, the **whole id is lowercased** (ULIDs are case-insensitive, so
 * nothing is lost). Without one (or with `""`/`null`), you get a plain
 * uppercase ULID. Don't put `_` in the prefix: the readers split on it and
 * reject ids with more than one.
 *
 * @param prefix - The prefix to prepend to the ULID.
 * @returns `${prefix}_${ulid}` lowercased, or the bare uppercase ULID.
 *
 * @example
 * ```ts
 * import { ulid } from "@xtandard/lib/ulid";
 *
 * ulid(); // "01M7TBRWANV2MSVCCBCQ4A7YQ5"
 * ulid("usr"); // "usr_01m7tbrwan37av71g87ysf541z"
 * ulid("USR"); // "usr_01m7…" (prefix lowercased too)
 * ```
 */
export function ulid(prefix?: string | null): string {
  const id = _ulid();
  return prefix ? `${prefix}_${id}`.toLowerCase() : id;
}

/**
 * Get the ULID part of a prefixed (`usr_01jd…`) or plain id, uppercased.
 *
 * It only strips the prefix and **does not validate** the ULID itself:
 * `"usr_hello"` gives `"HELLO"`. Use {@link isValidUlid} when you need a real
 * ULID.
 *
 * @returns The ULID part, or `null` for an empty id or one with more than one
 *   `_`. With `throwOnInvalid: true`, those cases throw instead
 *   (`"ID is required"` / `"Invalid ID format"`).
 *
 * @example
 * ```ts
 * import { getUlidFromId } from "@xtandard/lib/ulid";
 *
 * getUlidFromId({ id: "usr_01jd8x3kq6f2v9w4z7y5b8c1ne" }); // "01JD8X3KQ6F2V9W4Z7Y5B8C1NE"
 * getUlidFromId({ id: "01JD8X3KQ6F2V9W4Z7Y5B8C1NE" }); // "01JD8X3KQ6F2V9W4Z7Y5B8C1NE"
 * getUlidFromId({ id: "usr_hello" }); // "HELLO" (not validated)
 * getUlidFromId({ id: "a_b_c" }); // null
 * getUlidFromId({ id: "a_b_c", throwOnInvalid: true }); // throws Error("Invalid ID format")
 * ```
 */
export function getUlidFromId({
  id,
  throwOnInvalid = false,
}: {
  id: string;
  throwOnInvalid?: boolean;
}): string | null {
  if (!id) {
    return valueOrThrow({
      value: null,
      error: "ID is required",
      throwOnInvalid,
    });
  }

  if (typeof id !== "string") {
    return valueOrThrow({
      value: null,
      error: "ID must be a string",
      throwOnInvalid,
    });
  }

  const parts = id.split("_");

  if (parts.length > 2) {
    return valueOrThrow({
      value: null,
      error: "Invalid ID format",
      throwOnInvalid,
    });
  }

  const [first, second] = parts;
  const raw = second ?? first;
  if (!raw) {
    return valueOrThrow({
      value: null,
      error: "Invalid ID format",
      throwOnInvalid,
    });
  }

  const ulid = raw.toUpperCase();

  return ulid;
}

/**
 * Whether a prefixed or plain id holds a well-formed 26-character ULID
 * (Crockford base32, case-insensitive).
 *
 * With `throwOnInvalid: true` it throws only when no ULID part can be extracted
 * (empty id, more than one `_`); a malformed ULID still returns `false`.
 *
 * @example Check a route param
 * ```ts
 * import { isValidUlid } from "@xtandard/lib/ulid";
 *
 * isValidUlid({ id: "usr_01jd8x3kq6f2v9w4z7y5b8c1ne" }); // true
 * isValidUlid({ id: "usr_hello" }); // false
 * isValidUlid({ id: "" }); // false
 * isValidUlid({ id: "", throwOnInvalid: true }); // throws Error("ID is required")
 * ```
 */
export function isValidUlid({
  id,
  throwOnInvalid = false,
}: {
  id: string;
  throwOnInvalid?: boolean;
}): boolean | null {
  const ulid = getUlidFromId({ id, throwOnInvalid });

  if (!ulid) {
    return valueOrThrow({
      value: false,
      error: "Invalid ID format",
      throwOnInvalid,
    });
  }

  return isValid(ulid);
}

/**
 * Read the creation time embedded in a prefixed or plain ULID, in epoch
 * milliseconds.
 *
 * @returns The timestamp, or `null` when the id isn't a valid ULID. With
 *   `throwOnInvalid: true`, any invalid id throws instead.
 *
 * @example
 * ```ts
 * import { getTimestampFromUlid } from "@xtandard/lib/ulid";
 *
 * getTimestampFromUlid({ id: "usr_01jd8x3kq6f2v9w4z7y5b8c1ne" }); // 1732244524774
 * getTimestampFromUlid({ id: "usr_hello" }); // null
 * getTimestampFromUlid({ id: "usr_hello", throwOnInvalid: true }); // throws Error("Invalid ID format")
 * ```
 */
export function getTimestampFromUlid({
  id,
  throwOnInvalid = false,
}: {
  id: string;
  throwOnInvalid?: boolean;
}): number | null {
  const ulid = getUlidFromId({ id, throwOnInvalid });

  if (!ulid) {
    return valueOrThrow({
      value: null,
      error: "Invalid ID format",
      throwOnInvalid,
    });
  }

  if (!isValidUlid({ id, throwOnInvalid })) {
    return valueOrThrow({
      value: null,
      error: "Invalid ID format",
      throwOnInvalid,
    });
  }

  return decodeTime(ulid);
}

/**
 * Read the creation time embedded in a prefixed or plain ULID, as a `Date`.
 * Handy as a coarse "created at" for debugging and sorting; don't use it in
 * place of a stored timestamp.
 *
 * @returns The `Date`, or `null` when the id isn't a valid ULID. With
 *   `throwOnInvalid: true`, any invalid id throws instead. A ULID whose
 *   timestamp is `0` (`"00000000000000000000000000"`) is valid and gives the epoch.
 *
 * @example
 * ```ts
 * import { getDateFromUlid } from "@xtandard/lib/ulid";
 *
 * getDateFromUlid({ id: "usr_01jd8x3kq6f2v9w4z7y5b8c1ne" }); // Date 2024-11-22T03:02:04.774Z
 * getDateFromUlid({ id: "usr_hello" }); // null
 * ```
 */
export function getDateFromUlid({
  id,
  throwOnInvalid = false,
}: {
  id: string;
  throwOnInvalid?: boolean;
}): Date | null {
  const timestamp = getTimestampFromUlid({ id, throwOnInvalid });
  if (timestamp === null || timestamp === undefined) {
    return valueOrThrow({
      value: null,
      error: "Invalid ID format",
      throwOnInvalid,
    });
  }

  return new Date(timestamp);
}
