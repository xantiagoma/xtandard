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

  test("duration eq is by canonical string", () => {
    expect(
      parseAsDuration.eq(Temporal.Duration.from("PT30M"), Temporal.Duration.from("PT30M")),
    ).toBe(true);
    expect(
      parseAsDuration.eq(Temporal.Duration.from("PT30M"), Temporal.Duration.from("PT60M")),
    ).toBe(false);
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
