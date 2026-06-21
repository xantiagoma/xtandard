import { BigNumber } from "bignumber.js";
import { describe, expect, test } from "vitest";

import { Interval } from "../src/interval";
import { BigNumberInterval, bigNumberDomain } from "../src/interval-bignumber";

const bn = (s: string) => new BigNumber(s);

describe("BigNumberInterval — exact decimals (bignumber.js, continuous)", () => {
  test("exact length / format (no IEEE-754 fuzz)", () => {
    expect(BigNumberInterval.closed(bn("0.1"), bn("0.3")).length()).toBe(0.2);
    expect(BigNumberInterval.closed(bn("0.1"), bn("0.3")).toString()).toBe("[0.1,0.3]");
    expect(BigNumberInterval.fromStart(bn("0.1"), 0.2).toString()).toBe("[0.1,0.3)");
  });

  test("contains is exact; the domain is continuous", () => {
    const r = BigNumberInterval.closed(bn("0.1"), bn("0.3"));
    expect(r.contains(bn("0.2"))).toBe(true);
    expect(r.contains(bn("0.30000000000000004"))).toBe(false);
    expect(r.isDiscrete).toBe(false);
  });

  test("only finite members (NaN / ±Infinity rejected)", () => {
    const r = BigNumberInterval.closed(bn("0"), bn("1"));
    expect(r.contains(new BigNumber(NaN))).toBe(false);
    expect(r.contains(new BigNumber(Infinity))).toBe(false);
    expect(r.contains(new BigNumber(-Infinity))).toBe(false);
    // comparedTo returns null for NaN; the domain's guard maps that to 0.
    expect(bigNumberDomain.compare(new BigNumber(NaN), bn("1"))).toBe(0);
  });

  test("set operations + midpoint", () => {
    expect(
      BigNumberInterval.closed(bn("0"), bn("5"))
        .intersection(BigNumberInterval.closed(bn("3"), bn("8")))
        .toString(),
    ).toBe("[3,5]");
    expect(
      BigNumberInterval.closed(bn("1"), bn("5"))
        .union(BigNumberInterval.open(bn("5"), bn("10")))
        ?.toString(),
    ).toBe("[1,10)");
    expect(BigNumberInterval.closed(bn("0.1"), bn("0.3")).middle()?.toString()).toBe("0.2");
  });

  test("parse round-trips, arbitrary precision preserved", () => {
    expect(BigNumberInterval.parse("[0.1,0.3]").toString()).toBe("[0.1,0.3]");
    const hp = "[1.000000000000000000000000000001,2]";
    expect(BigNumberInterval.parse(hp).toString()).toBe(hp);
  });

  test("instanceof + the domain is continuous and named", () => {
    const r = BigNumberInterval.closed(bn("0"), bn("1"));
    expect(r).toBeInstanceOf(BigNumberInterval);
    expect(r).toBeInstanceOf(Interval);
    expect(bigNumberDomain.name).toBe("bignumber");
    expect(bigNumberDomain.next).toBeUndefined();
  });
});
