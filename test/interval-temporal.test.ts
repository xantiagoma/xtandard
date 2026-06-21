import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, test } from "vitest";

import {
  InstantInterval,
  PlainDateInterval,
  PlainDateTimeInterval,
  PlainTimeInterval,
  ZonedDateTimeInterval,
} from "../src/interval-temporal";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("InstantInterval (continuous, ms)", () => {
  const inst = (s: string) => Temporal.Instant.from(s);

  test("parse round-trips and contains respects bounds", () => {
    const i = InstantInterval.parse("[2026-01-01T00:00:00Z,2026-01-02T00:00:00Z)");
    expect(i.toString()).toBe("[2026-01-01T00:00:00Z,2026-01-02T00:00:00Z)");
    expect(i.contains(inst("2026-01-01T12:00:00Z"))).toBe(true);
    expect(i.contains(inst("2026-01-02T00:00:00Z"))).toBe(false); // open upper
    expect(i.isDiscrete).toBe(false);
  });

  test("length is the millisecond span; adjacent half-open ranges merge", () => {
    expect(
      InstantInterval.closedOpen(
        inst("2026-01-01T00:00:00Z"),
        inst("2026-01-01T01:00:00Z"),
      ).length(),
    ).toBe(HOUR);
    const merged = InstantInterval.closedOpen(
      inst("2026-01-01T00:00:00Z"),
      inst("2026-01-01T12:00:00Z"),
    ).union(InstantInterval.closedOpen(inst("2026-01-01T12:00:00Z"), inst("2026-01-02T00:00:00Z")));
    expect(
      merged?.equals(
        InstantInterval.closedOpen(inst("2026-01-01T00:00:00Z"), inst("2026-01-02T00:00:00Z")),
      ),
    ).toBe(true);
  });

  test("compare is nanosecond-exact even though measure is millisecond-granular", () => {
    // The bounds order/compare with full precision...
    const sub = InstantInterval.closedOpen(
      inst("2026-01-01T00:00:00.000000Z"),
      inst("2026-01-01T00:00:00.000500Z"), // 500 microseconds later
    );
    expect(sub.contains(inst("2026-01-01T00:00:00.000250Z"))).toBe(true);
    expect(sub.isEmpty).toBe(false);
    // ...but length()/measure() are in whole milliseconds, so a sub-ms span rounds to 0.
    expect(sub.length()).toBe(0);
  });

  test("intersection / difference", () => {
    const a = InstantInterval.closed(inst("2026-01-01T00:00:00Z"), inst("2026-01-10T00:00:00Z"));
    const b = InstantInterval.closed(inst("2026-01-05T00:00:00Z"), inst("2026-01-20T00:00:00Z"));
    expect(
      a
        .intersection(b)
        .equals(InstantInterval.closed(inst("2026-01-05T00:00:00Z"), inst("2026-01-10T00:00:00Z"))),
    ).toBe(true);
    expect(a.difference(b).map((p) => p.toString())).toEqual([
      InstantInterval.closedOpen(
        inst("2026-01-01T00:00:00Z"),
        inst("2026-01-05T00:00:00Z"),
      ).toString(),
    ]);
  });
});

describe("ZonedDateTimeInterval (continuous, ordered by instant)", () => {
  const zdt = (s: string) => Temporal.ZonedDateTime.from(s);

  test("parse round-trips and contains respects bounds", () => {
    const i = ZonedDateTimeInterval.closedOpen(
      zdt("2026-01-01T00:00:00[America/New_York]"),
      zdt("2026-01-02T00:00:00[America/New_York]"),
    );
    expect(ZonedDateTimeInterval.parse(i.toString()).equals(i)).toBe(true);
    expect(i.contains(zdt("2026-01-01T12:00:00[America/New_York]"))).toBe(true);
    expect(i.isDiscrete).toBe(false);
  });

  test("ordered by underlying instant across zones", () => {
    // 2026-01-01T00:00 in New York (UTC-5) is later than the same wall time in UTC.
    const utcMidnight = zdt("2026-01-01T00:00:00[UTC]");
    const nyMidnight = zdt("2026-01-01T00:00:00[America/New_York]");
    expect(
      ZonedDateTimeInterval.closed(utcMidnight, nyMidnight).contains(
        zdt("2026-01-01T03:00:00[UTC]"),
      ),
    ).toBe(true);
  });
});

describe("PlainDateInterval (discrete, ε 1 day)", () => {
  const pd = (s: string) => Temporal.PlainDate.from(s);

  test("calendar days are counted; toString shows the friendly closed form", () => {
    expect(PlainDateInterval.closed(pd("2026-01-01"), pd("2026-01-05")).length()).toBe(5); // 5 days
    expect(PlainDateInterval.closed(pd("2026-01-01"), pd("2026-01-05")).toString()).toBe(
      "[2026-01-01,2026-01-05]",
    );
    expect(PlainDateInterval.closed(pd("2026-01-01"), pd("2026-01-05")).isDiscrete).toBe(true);
  });

  test("adjacent day-ranges merge gap-free (epsilon 1 day)", () => {
    expect(
      PlainDateInterval.closed(pd("2026-01-01"), pd("2026-01-05"))
        .union(PlainDateInterval.closed(pd("2026-01-06"), pd("2026-01-10")))
        ?.toString(),
    ).toBe("[2026-01-01,2026-01-10]");
    // A gap of more than one day stays separate.
    expect(
      PlainDateInterval.closed(pd("2026-01-01"), pd("2026-01-05")).union(
        PlainDateInterval.closed(pd("2026-01-08"), pd("2026-01-10")),
      ),
    ).toBeNull();
  });

  test("a single day is a point", () => {
    expect(PlainDateInterval.point(pd("2026-01-01")).isPoint).toBe(true);
    expect(PlainDateInterval.closed(pd("2026-01-01"), pd("2026-01-05")).isPoint).toBe(false);
  });

  test("parse round-trips through the ISO date form", () => {
    expect(PlainDateInterval.parse("[2026-01-01,2026-01-05]").toString()).toBe(
      "[2026-01-01,2026-01-05]",
    );
  });
});

describe("PlainDateTimeInterval (continuous, floating wall date+time)", () => {
  const pdt = (s: string) => Temporal.PlainDateTime.from(s);

  test("parse round-trips, length is the ms span", () => {
    const i = PlainDateTimeInterval.closedOpen(
      pdt("2026-01-01T00:00:00"),
      pdt("2026-01-02T00:00:00"),
    );
    expect(PlainDateTimeInterval.parse(i.toString()).equals(i)).toBe(true);
    expect(i.length()).toBe(DAY);
    expect(i.contains(pdt("2026-01-01T12:00:00"))).toBe(true);
    expect(i.isDiscrete).toBe(false);
  });
});

describe("PlainTimeInterval (continuous, wall-clock time)", () => {
  const pt = (s: string) => Temporal.PlainTime.from(s);

  test("a working-hours window: length, contains, parse", () => {
    const shift = PlainTimeInterval.closedOpen(pt("09:00:00"), pt("17:00:00"));
    expect(shift.length()).toBe(8 * HOUR);
    expect(shift.contains(pt("12:30:00"))).toBe(true);
    expect(shift.contains(pt("17:00:00"))).toBe(false); // open upper
    expect(PlainTimeInterval.parse(shift.toString()).equals(shift)).toBe(true);
    expect(shift.isDiscrete).toBe(false);
  });
});

describe("midpoints exercise measure + add across the Temporal domains", () => {
  test("Instant midpoint", () => {
    const mid = InstantInterval.closed(
      Temporal.Instant.from("2026-01-01T00:00:00Z"),
      Temporal.Instant.from("2026-01-02T00:00:00Z"),
    ).middle();
    expect(mid?.equals(Temporal.Instant.from("2026-01-01T12:00:00Z"))).toBe(true);
  });

  test("ZonedDateTime length + midpoint", () => {
    const day = ZonedDateTimeInterval.closedOpen(
      Temporal.ZonedDateTime.from("2026-01-01T00:00:00[UTC]"),
      Temporal.ZonedDateTime.from("2026-01-02T00:00:00[UTC]"),
    );
    expect(day.length()).toBe(DAY);
    expect(
      ZonedDateTimeInterval.closed(
        Temporal.ZonedDateTime.from("2026-01-01T00:00:00[UTC]"),
        Temporal.ZonedDateTime.from("2026-01-02T00:00:00[UTC]"),
      ).middle()?.epochMilliseconds,
    ).toBe(Temporal.ZonedDateTime.from("2026-01-01T12:00:00[UTC]").epochMilliseconds);
  });

  test("PlainDate midpoint (day-granular)", () => {
    const mid = PlainDateInterval.closed(
      Temporal.PlainDate.from("2026-01-01"),
      Temporal.PlainDate.from("2026-01-05"),
    ).middle();
    expect(mid?.equals(Temporal.PlainDate.from("2026-01-03"))).toBe(true);
  });

  test("PlainDateTime midpoint", () => {
    const mid = PlainDateTimeInterval.closed(
      Temporal.PlainDateTime.from("2026-01-01T00:00:00"),
      Temporal.PlainDateTime.from("2026-01-02T00:00:00"),
    ).middle();
    expect(mid?.equals(Temporal.PlainDateTime.from("2026-01-01T12:00:00"))).toBe(true);
  });

  test("PlainTime midpoint", () => {
    const mid = PlainTimeInterval.closed(
      Temporal.PlainTime.from("09:00:00"),
      Temporal.PlainTime.from("17:00:00"),
    ).middle();
    expect(mid?.equals(Temporal.PlainTime.from("13:00:00"))).toBe(true);
  });
});
