import Fraction from "fraction.js";
import { describe, expect, test } from "vitest";

import { Interval } from "../src/interval";
import { FractionInterval, fractionDomain } from "../src/interval-fraction";

const f = (n: number, d: number) => new Fraction(n, d);

describe("FractionInterval — exact rationals (fraction.js, continuous)", () => {
  test("rationals are exact and render as n/d (1/3 never rounds)", () => {
    expect(FractionInterval.closed(f(1, 3), f(2, 3)).toString()).toBe("[1/3,2/3]");
    expect(FractionInterval.parse("[1/3,2/3]").toString()).toBe("[1/3,2/3]");
    // fraction.js reduces, so 2/6 and 4/6 normalize to 1/3 and 2/3:
    expect(FractionInterval.closed(f(2, 6), f(4, 6)).toString()).toBe("[1/3,2/3]");
    expect(FractionInterval.closed(f(0, 1), f(1, 1)).toString()).toBe("[0,1]");
  });

  test("contains is exact to the rational; continuous", () => {
    const r = FractionInterval.closed(f(1, 3), f(2, 3));
    expect(r.contains(f(1, 2))).toBe(true); // 1/2 ∈ [1/3, 2/3]
    expect(r.contains(f(1, 3))).toBe(true);
    expect(r.contains(f(1, 4))).toBe(false); // 1/4 < 1/3
    expect(r.isDiscrete).toBe(false);
  });

  test("set operations keep exact endpoints", () => {
    expect(
      FractionInterval.closed(f(0, 1), f(1, 1))
        .intersection(FractionInterval.closed(f(1, 2), f(3, 2)))
        .toString(),
    ).toBe("[1/2,1]");
    expect(
      FractionInterval.closed(f(0, 1), f(1, 1))
        .difference(FractionInterval.open(f(1, 3), f(2, 3)))
        .map((p) => p.toString()),
    ).toEqual(["[0,1/3]", "[2/3,1]"]);
    // continuous: closed ∪ open at the touch point merges
    expect(
      FractionInterval.closed(f(0, 1), f(1, 2))
        .union(FractionInterval.open(f(1, 2), f(1, 1)))
        ?.toString(),
    ).toBe("[0,1)");
  });

  test("midpoint", () => {
    expect(FractionInterval.closed(f(0, 1), f(1, 1)).middle()?.toFraction()).toBe("1/2");
  });

  test("instanceof + the domain is continuous and named", () => {
    const r = FractionInterval.closed(f(0, 1), f(1, 1));
    expect(r).toBeInstanceOf(FractionInterval);
    expect(r).toBeInstanceOf(Interval);
    expect(fractionDomain.name).toBe("fraction");
    expect(fractionDomain.next).toBeUndefined();
  });
});
