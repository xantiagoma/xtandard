import { describe, expect, test } from "vitest";
import { Temporal } from "temporal-polyfill";

import { durationToMs, toDuration } from "../src/duration-utils";

describe("toDuration", () => {
  test("from number (milliseconds)", () => {
    const d = toDuration(500);
    expect(d.total({ unit: "milliseconds" })).toBe(500);
  });

  test("from ISO string", () => {
    const d = toDuration("PT2H");
    expect(d.total({ unit: "hours" })).toBe(2);
  });

  test("from Temporal.Duration (passthrough)", () => {
    const d = Temporal.Duration.from({ minutes: 15 });
    expect(toDuration(d)).toBe(d);
  });

  test("throws on NaN", () => {
    expect(() => toDuration(Number.NaN)).toThrow(RangeError);
  });

  test("throws on empty string", () => {
    expect(() => toDuration("")).toThrow(RangeError);
  });
});

describe("durationToMs", () => {
  test("number passthrough", () => {
    expect(durationToMs(5000)).toBe(5000);
  });

  test("ISO time duration", () => {
    expect(durationToMs("PT2H")).toBe(7_200_000);
  });

  test("PT30M", () => {
    expect(durationToMs("PT30M")).toBe(1_800_000);
  });

  test("calendar duration requires relativeTo", () => {
    expect(() => durationToMs("P1D")).toThrow(RangeError);
  });

  test("calendar duration with relativeTo", () => {
    expect(durationToMs("P1D", { relativeTo: "2025-01-01T00:00:00Z" })).toBe(86_400_000);
  });

  test("throws on NaN", () => {
    expect(() => durationToMs(Number.NaN)).toThrow(RangeError);
  });
});
