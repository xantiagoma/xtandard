import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, test } from "vitest";

import type { Parser } from "../src/tanstack/core/parser.ts";
import {
  parseAsDuration,
  parseAsInstant,
  parseAsPlainDate,
  parseAsPlainDateTime,
  parseAsPlainTime,
  parseAsTimeZone,
  parseAsZonedDateTime,
} from "../src/tanstack/temporal.ts";

// Generic so each case keeps its concrete `T`; a single heterogeneous array
// would collapse `parser`/`value` to a union and force `eq`/`serialize` to the
// `never` intersection.
function expectRoundTrip<T extends { toString: () => string }>(parser: Parser<T>, value: T): void {
  const token = parser.serialize(value);
  const parsed = parser.parse(token);

  expect(parsed).not.toBeNull();
  expect(parser.eq(parsed ?? value, value)).toBe(true);
  // canonical: re-serializing the parsed value yields the same token
  expect(parsed === null ? null : parser.serialize(parsed)).toBe(token);
}

const cases = [
  {
    name: "instant",
    parser: parseAsInstant,
    check: () => expectRoundTrip(parseAsInstant, Temporal.Instant.from("2026-06-18T16:00:00Z")),
  },
  {
    name: "plainDate",
    parser: parseAsPlainDate,
    check: () => expectRoundTrip(parseAsPlainDate, Temporal.PlainDate.from("2026-12-25")),
  },
  {
    name: "plainTime",
    parser: parseAsPlainTime,
    check: () => expectRoundTrip(parseAsPlainTime, Temporal.PlainTime.from("09:00:00")),
  },
  {
    name: "plainDateTime",
    parser: parseAsPlainDateTime,
    check: () =>
      expectRoundTrip(parseAsPlainDateTime, Temporal.PlainDateTime.from("2026-12-25T09:00:00")),
  },
  {
    name: "zonedDateTime",
    parser: parseAsZonedDateTime,
    check: () =>
      expectRoundTrip(
        parseAsZonedDateTime,
        Temporal.ZonedDateTime.from("2026-06-18T09:00:00-07:00[America/Los_Angeles]"),
      ),
  },
  {
    name: "duration",
    parser: parseAsDuration,
    check: () => expectRoundTrip(parseAsDuration, Temporal.Duration.from("PT30M")),
  },
] as const;

describe("temporal parsers", () => {
  for (const { name, parser, check } of cases) {
    test(`${name}: round-trips through serialize → parse`, check);

    test(`${name}: invalid string → null`, () => {
      expect(parser.parse("not-a-temporal-value")).toBeNull();
    });
  }

  test("instant serializes to canonical ISO-8601 UTC", () => {
    expect(parseAsInstant.serialize(Temporal.Instant.from("2026-06-18T16:00:00Z"))).toBe(
      "2026-06-18T16:00:00Z",
    );
  });

  test("zonedDateTime preserves the IANA bracket form", () => {
    const zoned = Temporal.ZonedDateTime.from("2026-06-18T09:00:00-07:00[America/Los_Angeles]");
    expect(parseAsZonedDateTime.serialize(zoned)).toContain("[America/Los_Angeles]");
  });

  test("duration eq compares length, not spelling", () => {
    const eq = (a: string, b: string): boolean =>
      parseAsDuration.eq(Temporal.Duration.from(a), Temporal.Duration.from(b));
    expect(eq("PT30M", "PT30M")).toBe(true);
    expect(eq("PT30M", "PT60M")).toBe(false);
    expect(eq("PT90M", "PT1H30M")).toBe(true);
    expect(eq("PT3600S", "PT1H")).toBe(true);
    expect(eq("P1D", "PT24H")).toBe(true);
    expect(eq("-PT90M", "-PT1H30M")).toBe(true);
    expect(eq("-PT90M", "PT90M")).toBe(false);
  });

  test("duration eq needs calendar units (Y/M/W) to match exactly, without throwing", () => {
    const eq = (a: string, b: string): boolean =>
      parseAsDuration.eq(Temporal.Duration.from(a), Temporal.Duration.from(b));
    expect(eq("P1M", "P1M")).toBe(true);
    expect(eq("P1M", "P2M")).toBe(false);
    expect(eq("P1M", "P30D")).toBe(false);
    expect(eq("P1Y", "P12M")).toBe(false);
    expect(eq("P1W", "P7D")).toBe(false);
    // Same calendar part, time part compared by length.
    expect(eq("P1MT90M", "P1MT1H30M")).toBe(true);
    expect(eq("P1MT90M", "P1MT1H")).toBe(false);
  });

  describe("parseAsTimeZone", () => {
    test("round-trips a valid IANA id", () => {
      const parsed = parseAsTimeZone.parse("America/Los_Angeles");

      expect(parsed).not.toBeNull();
      expect(parsed === null ? null : parseAsTimeZone.serialize(parsed)).toBe(
        "America/Los_Angeles",
      );
    });

    test("accepts UTC", () => {
      expect(parseAsTimeZone.parse("UTC")).toBe("UTC");
    });

    test("unknown id → null", () => {
      expect(parseAsTimeZone.parse("Not/AZone")).toBeNull();
    });
  });
});
