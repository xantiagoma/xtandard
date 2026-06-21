import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";

import { Interval } from "../src/interval";
import { DecimalInterval, decimalDomain } from "../src/interval-decimal";
import { NumberInterval } from "../src/interval-domains";

const d = (s: string) => new Decimal(s);

describe("DecimalInterval — exact decimals (continuous)", () => {
  test("fixes the IEEE-754 fuzz that NumberInterval exhibits", () => {
    // NumberInterval (plain float) leaks the representation error:
    expect(NumberInterval.closed(0.1, 0.3).length()).not.toBe(0.2);
    expect(NumberInterval.fromStart(0.1, 0.2).toString()).toBe("[0.1,0.30000000000000004)");
    // DecimalInterval computes exactly, then reports a clean result:
    expect(DecimalInterval.closed(d("0.1"), d("0.3")).length()).toBe(0.2);
    expect(DecimalInterval.closed(d("0.1"), d("0.3")).toString()).toBe("[0.1,0.3]");
    expect(DecimalInterval.fromStart(d("0.1"), 0.2).toString()).toBe("[0.1,0.3)");
  });

  test("contains is exact to the decimal", () => {
    const r = DecimalInterval.closed(d("0.1"), d("0.3"));
    expect(r.contains(d("0.2"))).toBe(true);
    expect(r.contains(d("0.1"))).toBe(true);
    expect(r.contains(d("0.3"))).toBe(true);
    expect(r.contains(d("0.30000000000000004"))).toBe(false); // strictly > 0.3
    expect(r.isDiscrete).toBe(false); // dense — continuous
  });

  test("middle is the exact midpoint", () => {
    expect(DecimalInterval.closed(d("0.1"), d("0.3")).middle()?.toString()).toBe("0.2");
    expect(DecimalInterval.closed(d("1"), d("2")).middle()?.toString()).toBe("1.5");
  });

  test("set operations (continuous): intersection / difference / union", () => {
    expect(
      DecimalInterval.closed(d("0"), d("5"))
        .intersection(DecimalInterval.closed(d("3"), d("8")))
        .toString(),
    ).toBe("[3,5]");
    expect(
      DecimalInterval.closed(d("0"), d("10"))
        .difference(DecimalInterval.open(d("4"), d("6")))
        .map((p) => p.toString()),
    ).toEqual(["[0,4]", "[6,10]"]);
    // continuous: closed ∪ open at the touch point merges, an integer-looking gap does not
    expect(
      DecimalInterval.closed(d("1"), d("5"))
        .union(DecimalInterval.open(d("5"), d("10")))
        ?.toString(),
    ).toBe("[1,10)");
    expect(
      DecimalInterval.closed(d("1"), d("5")).union(DecimalInterval.closed(d("6"), d("10"))),
    ).toBeNull();
  });

  test("parse round-trips; arbitrary precision is preserved", () => {
    expect(DecimalInterval.parse("[0.1,0.3]").toString()).toBe("[0.1,0.3]");
    // 30 significant digits survive — no float truncation
    const hp = "[1.000000000000000000000000000001,2]";
    expect(DecimalInterval.parse(hp).toString()).toBe(hp);
  });

  test("only finite decimals are members (NaN / ±Infinity rejected)", () => {
    const r = DecimalInterval.closed(d("0"), d("1"));
    expect(r.contains(new Decimal(NaN))).toBe(false);
    expect(r.contains(new Decimal(Infinity))).toBe(false);
    expect(r.contains(new Decimal(-Infinity))).toBe(false);
  });

  test("instances are instanceof the bound class and Interval", () => {
    const r = DecimalInterval.closed(d("0"), d("1"));
    expect(r).toBeInstanceOf(DecimalInterval);
    expect(r).toBeInstanceOf(Interval);
  });

  test("the domain is continuous and named", () => {
    expect(decimalDomain.name).toBe("decimal");
    expect(decimalDomain.next).toBeUndefined(); // no successor → continuous
  });
});
