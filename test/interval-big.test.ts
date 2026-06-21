import Big from "big.js";
import { describe, expect, test } from "vitest";

import { Interval } from "../src/interval";
import { BigInterval, bigDomain } from "../src/interval-big";

const b = (s: string) => new Big(s);

describe("BigInterval — exact decimals (big.js, continuous)", () => {
  test("exact length / format (no IEEE-754 fuzz)", () => {
    expect(BigInterval.closed(b("0.1"), b("0.3")).length()).toBe(0.2);
    expect(BigInterval.closed(b("0.1"), b("0.3")).toString()).toBe("[0.1,0.3]");
    expect(BigInterval.fromStart(b("0.1"), 0.2).toString()).toBe("[0.1,0.3)");
  });

  test("contains is exact; the domain is continuous", () => {
    const r = BigInterval.closed(b("0.1"), b("0.3"));
    expect(r.contains(b("0.2"))).toBe(true);
    expect(r.contains(b("0.30000000000000004"))).toBe(false); // strictly > 0.3
    expect(r.isDiscrete).toBe(false);
  });

  test("set operations + midpoint", () => {
    expect(
      BigInterval.closed(b("0"), b("5"))
        .intersection(BigInterval.closed(b("3"), b("8")))
        .toString(),
    ).toBe("[3,5]");
    expect(
      BigInterval.closed(b("1"), b("5"))
        .union(BigInterval.open(b("5"), b("10")))
        ?.toString(),
    ).toBe("[1,10)");
    expect(
      BigInterval.closed(b("1"), b("5")).union(BigInterval.closed(b("6"), b("10"))),
    ).toBeNull();
    expect(BigInterval.closed(b("0.1"), b("0.3")).middle()?.toString()).toBe("0.2");
  });

  test("parse round-trips, arbitrary precision preserved", () => {
    expect(BigInterval.parse("[0.1,0.3]").toString()).toBe("[0.1,0.3]");
    const hp = "[1.000000000000000000000000000001,2]";
    expect(BigInterval.parse(hp).toString()).toBe(hp);
  });

  test("instanceof + the domain is continuous and named", () => {
    const r = BigInterval.closed(b("0"), b("1"));
    expect(r).toBeInstanceOf(BigInterval);
    expect(r).toBeInstanceOf(Interval);
    expect(bigDomain.name).toBe("big");
    expect(bigDomain.next).toBeUndefined();
  });
});
