import { describe, expect, test } from "vitest";

import {
  getDateFromUlid,
  getTimestampFromUlid,
  getUlidFromId,
  isValidUlid,
  ulid,
} from "../src/ulid-utils";

describe("ulid", () => {
  test("generates a string", () => {
    expect(typeof ulid()).toBe("string");
  });

  test("generates unique values", () => {
    expect(ulid()).not.toBe(ulid());
  });

  test("with prefix", () => {
    const id = ulid("usr");
    expect(id.startsWith("usr_")).toBe(true);
  });

  test("without prefix", () => {
    const id = ulid();
    expect(id.includes("_")).toBe(false);
  });

  test("prefix is lowercased", () => {
    const id = ulid("USR");
    expect(id.startsWith("usr_")).toBe(true);
  });
});

describe("getUlidFromId", () => {
  test("extracts ULID from prefixed id", () => {
    const raw = ulid();
    const id = `usr_${raw}`;
    expect(getUlidFromId({ id })).toBe(raw.toUpperCase());
  });

  test("returns uppercased ULID from plain id", () => {
    const id = ulid();
    expect(getUlidFromId({ id })).toBe(id.toUpperCase());
  });

  test("returns null for empty string", () => {
    expect(getUlidFromId({ id: "" })).toBeNull();
  });

  test("throws for empty string when throwOnInvalid", () => {
    expect(() => getUlidFromId({ id: "", throwOnInvalid: true })).toThrow();
  });
});

describe("isValidUlid", () => {
  test("valid ulid", () => {
    expect(isValidUlid({ id: ulid() })).toBe(true);
  });

  test("valid prefixed ulid", () => {
    expect(isValidUlid({ id: ulid("usr") })).toBe(true);
  });

  test("invalid string", () => {
    expect(isValidUlid({ id: "not-a-ulid" })).toBe(false);
  });
});

describe("getTimestampFromUlid", () => {
  test("returns a number for valid ulid", () => {
    const ts = getTimestampFromUlid({ id: ulid() });
    expect(typeof ts).toBe("number");
    expect(ts).toBeGreaterThan(0);
  });

  test("returns null for invalid", () => {
    expect(getTimestampFromUlid({ id: "invalid" })).toBeNull();
  });
});

describe("getDateFromUlid", () => {
  test("returns a Date for valid ulid", () => {
    const date = getDateFromUlid({ id: ulid() });
    expect(date).toBeInstanceOf(Date);
  });

  test("returns null for invalid", () => {
    expect(getDateFromUlid({ id: "invalid" })).toBeNull();
  });
});
