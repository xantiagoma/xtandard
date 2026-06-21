import { describe, expect, test } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { dateToInstant, instantToDate, toDate, toInstant } from "../src/datetime-utils";

describe("dateToInstant", () => {
  test("converts valid Date", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    const instant = dateToInstant(date);
    expect(instant.epochMilliseconds).toBe(date.getTime());
  });

  test("throws on invalid Date", () => {
    expect(() => dateToInstant(new Date("invalid"))).toThrow(RangeError);
  });
});

describe("instantToDate", () => {
  test("converts valid Instant", () => {
    const instant = Temporal.Instant.from("2025-01-01T00:00:00Z");
    const date = instantToDate(instant);
    expect(date.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });
});

describe("toDate", () => {
  test("from Date", () => {
    const d = new Date("2025-06-15T12:00:00Z");
    const result = toDate(d);
    expect(result.getTime()).toBe(d.getTime());
    expect(result).not.toBe(d); // cloned
  });

  test("from Temporal.Instant", () => {
    const instant = Temporal.Instant.from("2025-01-01T00:00:00Z");
    expect(toDate(instant).toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  test("from epoch number", () => {
    const ms = new Date("2025-01-01T00:00:00Z").getTime();
    expect(toDate(ms).toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  test("from ISO string", () => {
    expect(toDate("2025-01-01T00:00:00Z").toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  test("from date-only string", () => {
    const result = toDate("2025-01-01");
    expect(result.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  test("throws on invalid string", () => {
    expect(() => toDate("not-a-date")).toThrow(RangeError);
  });

  test("throws on empty string", () => {
    expect(() => toDate("")).toThrow(RangeError);
  });
});

describe("toInstant", () => {
  test("from Temporal.Instant (passthrough)", () => {
    const instant = Temporal.Instant.from("2025-01-01T00:00:00Z");
    expect(toInstant(instant)).toBe(instant);
  });

  test("from Date", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    expect(toInstant(date).epochMilliseconds).toBe(date.getTime());
  });

  test("from epoch number", () => {
    const ms = 1735689600000;
    expect(toInstant(ms).epochMilliseconds).toBe(ms);
  });

  test("from ISO string", () => {
    const instant = toInstant("2025-01-01T00:00:00Z");
    expect(instant.epochMilliseconds).toBe(new Date("2025-01-01T00:00:00Z").getTime());
  });

  test("throws on invalid string", () => {
    expect(() => toInstant("not-a-date")).toThrow(RangeError);
  });

  test("throws on NaN", () => {
    expect(() => toInstant(Number.NaN)).toThrow(RangeError);
  });
});
