import { describe, expect, test } from "vitest";

import { hoursToMs, minutesToMs, secondsToMs } from "../src/time-convert";

describe("secondsToMs", () => {
  test("1 second", () => expect(secondsToMs(1)).toBe(1000));
  test("0 seconds", () => expect(secondsToMs(0)).toBe(0));
  test("fractional", () => expect(secondsToMs(0.5)).toBe(500));
});

describe("minutesToMs", () => {
  test("1 minute", () => expect(minutesToMs(1)).toBe(60_000));
  test("5 minutes", () => expect(minutesToMs(5)).toBe(300_000));
});

describe("hoursToMs", () => {
  test("1 hour", () => expect(hoursToMs(1)).toBe(3_600_000));
  test("24 hours", () => expect(hoursToMs(24)).toBe(86_400_000));
});
