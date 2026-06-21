import { dinero, JPY, toSnapshot, USD } from "dinero.js";
import { describe, expect, test } from "vitest";

import { Interval } from "../src/interval";
import { createDineroInterval, dineroDomain } from "../src/interval-dinero";

const UsdInterval = createDineroInterval(USD);
const usd = (cents: number) => dinero({ amount: cents, currency: USD });

describe("DineroInterval — USD (discrete, ε 1 cent)", () => {
  test("contains respects bounds (string form is minor units)", () => {
    const tier = UsdInterval.closed(usd(5_000), usd(10_000)); // $50.00 – $100.00
    expect(tier.toString()).toBe("[5000,10000]");
    expect(tier.contains(usd(7_500))).toBe(true);
    expect(tier.contains(usd(5_000))).toBe(true);
    expect(tier.contains(usd(10_000))).toBe(true);
    expect(tier.contains(usd(4_999))).toBe(false);
    expect(tier.contains(usd(10_001))).toBe(false);
    expect(tier.isDiscrete).toBe(true);
  });

  test("length counts cents; middle is the median amount", () => {
    expect(UsdInterval.closed(usd(5_000), usd(5_005)).length()).toBe(6); // {5000..5005}
    const mid = UsdInterval.closed(usd(100), usd(105)).middle();
    expect(mid ? toSnapshot(mid).amount : null).toBe(103);
  });

  test("union merges cent-adjacent ranges; a ≥2-cent gap stays null", () => {
    expect(
      UsdInterval.closed(usd(100), usd(105))
        .union(UsdInterval.closed(usd(106), usd(110)))
        ?.toString(),
    ).toBe("[100,110]");
    expect(
      UsdInterval.closed(usd(100), usd(105)).union(UsdInterval.closed(usd(108), usd(110))),
    ).toBeNull();
  });

  test("intersection / difference / gap / span", () => {
    expect(
      UsdInterval.closed(usd(100), usd(110))
        .intersection(UsdInterval.closed(usd(105), usd(120)))
        .toString(),
    ).toBe("[105,110]");
    expect(
      UsdInterval.closed(usd(100), usd(110))
        .difference(UsdInterval.closed(usd(104), usd(106)))
        .map((p) => p.toString()),
    ).toEqual(["[100,103]", "[107,110]"]);
    expect(
      UsdInterval.closed(usd(100), usd(103))
        .gap(UsdInterval.closed(usd(107), usd(109)))
        ?.toString(),
    ).toBe("[104,106]");
    expect(
      UsdInterval.closed(usd(100), usd(103))
        .span(UsdInterval.closed(usd(107), usd(109)))
        .toString(),
    ).toBe("[100,109]");
  });

  test("parse round-trips through the minor-unit form", () => {
    expect(UsdInterval.parse("[5000,10000]").toString()).toBe("[5000,10000]");
    expect(UsdInterval.parse("[5000,10000]").contains(usd(7_500))).toBe(true);
  });

  test("instances are instanceof the bound class and Interval", () => {
    const i = UsdInterval.closed(usd(0), usd(100));
    expect(i).toBeInstanceOf(UsdInterval);
    expect(i).toBeInstanceOf(Interval);
  });

  test("compare is exact: a sub-cent value is still a member", () => {
    // $1.2345 (scale 4) sits inside [$1.00, $2.00] — compare uses dinero's exact
    // comparison even though the epsilon/length work on the whole-cent grid.
    const range = UsdInterval.closed(usd(100), usd(200));
    expect(range.contains(dinero({ amount: 12_345, currency: USD, scale: 4 }))).toBe(true);
  });

  test("the domain is named per currency", () => {
    expect(dineroDomain(USD).name).toBe("dinero:USD");
  });
});

describe("DineroInterval — JPY (discrete, ε 1 yen, exponent 0)", () => {
  const JpyInterval = createDineroInterval(JPY);
  const jpy = (yen: number) => dinero({ amount: yen, currency: JPY });

  test("whole yen are the minor unit", () => {
    expect(JpyInterval.closed(jpy(100), jpy(105)).length()).toBe(6); // {100..105}
    expect(JpyInterval.closed(jpy(100), jpy(105)).toString()).toBe("[100,105]");
    expect(JpyInterval.closed(jpy(100), jpy(100)).isPoint).toBe(true);
  });

  test("adjacent yen ranges merge; parse round-trips", () => {
    expect(
      JpyInterval.closed(jpy(100), jpy(105))
        .union(JpyInterval.closed(jpy(106), jpy(110)))
        ?.toString(),
    ).toBe("[100,110]");
    expect(JpyInterval.parse("[100,105]").toString()).toBe("[100,105]");
  });

  test("the domain is named per currency", () => {
    expect(dineroDomain(JPY).name).toBe("dinero:JPY");
  });
});
