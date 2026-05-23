import { ulid as _ulid, decodeTime } from "ulid";

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const isValid = (id: string): boolean => ULID_REGEX.test(id);

import { valueOrThrow } from "./error";

/**
 * Generates a prefixed ULID.
 * @param prefix - The prefix to prepend to the ULID.
 * @returns A string in the format `${prefix}_${ulid}`.
 */
export function ulid(prefix?: string | null): string {
  const id = _ulid();
  return prefix ? `${prefix}_${id}`.toLowerCase() : id;
}

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

export function getDateFromUlid({
  id,
  throwOnInvalid = false,
}: {
  id: string;
  throwOnInvalid?: boolean;
}): Date | null {
  const timestamp = getTimestampFromUlid({ id, throwOnInvalid });
  if (!timestamp) {
    return valueOrThrow({
      value: null,
      error: "Invalid ID format",
      throwOnInvalid,
    });
  }

  return new Date(timestamp);
}
