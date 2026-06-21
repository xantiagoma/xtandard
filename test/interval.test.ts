import { describe, expect, test } from "vitest";

import {
  defineIntervalType,
  Interval,
  type IntervalDomain,
  mergeIntervals,
  parseInterval,
} from "../src/interval";
import {
  BigIntInterval,
  bigIntDomain,
  DateInterval,
  IntegerInterval,
  NumberInterval,
  numberDomain,
} from "../src/interval-domains";

// Concise builder from strings, for the example-table tests.
const N = (s: string) => NumberInterval.parse(s);

describe("contains", () => {
  test("closed includes both ends", () => {
    const i = NumberInterval.closed(1, 5);
    expect(i.contains(1)).toBe(true);
    expect(i.contains(5)).toBe(true);
    expect(i.contains(0.999)).toBe(false);
    expect(i.contains(5.001)).toBe(false);
  });

  test("open excludes both ends", () => {
    const i = NumberInterval.open(1, 5);
    expect(i.contains(1)).toBe(false);
    expect(i.contains(5)).toBe(false);
    expect(i.contains(3)).toBe(true);
  });

  test("half-open and unbounded", () => {
    expect(NumberInterval.closedOpen(1, 5).contains(5)).toBe(false);
    expect(NumberInterval.openClosed(1, 5).contains(5)).toBe(true);
    expect(NumberInterval.atLeast(0).contains(1e9)).toBe(true);
    expect(NumberInterval.atLeast(0).contains(-1)).toBe(false);
    expect(NumberInterval.all().contains(-1e9)).toBe(true);
    expect(NumberInterval.empty().contains(0)).toBe(false);
  });
});

describe("parse ↔ format round trip", () => {
  const cases = [
    "[1,5]",
    "(1,5)",
    "[1,5)",
    "(1,5]",
    "(-Infinity,5]",
    "[5,+Infinity)",
    "(-Infinity,+Infinity)",
  ];

  for (const text of cases) {
    test(text, () => {
      expect(NumberInterval.parse(text).toString()).toBe(text);
    });
  }

  test("empty", () => {
    expect(NumberInterval.empty().toString()).toBe("∅");
    expect(NumberInterval.parse("∅").isEmpty).toBe(true);
  });

  test("infinity token variants accepted, all normalize to canonical ±Infinity", () => {
    // `Inf` / `Infinity` / `∞` (any case, optional sign) are all accepted on parse,
    // but toString() always emits the canonical `+Infinity` / `-Infinity`.
    expect(NumberInterval.parse("(-inf,0]").toString()).toBe("(-Infinity,0]");
    expect(NumberInterval.parse("(-Inf,0]").toString()).toBe("(-Infinity,0]");
    expect(NumberInterval.parse("[0,infinity)").toString()).toBe("[0,+Infinity)");
    expect(NumberInterval.parse("[0,+Inf)").toString()).toBe("[0,+Infinity)");
    expect(NumberInterval.parse("[0,+∞)").toString()).toBe("[0,+Infinity)");
    expect(NumberInterval.parse("(-∞,0]").toString()).toBe("(-Infinity,0]");
    expect(NumberInterval.parse("(-Infinity,+Infinity)").toString()).toBe("(-Infinity,+Infinity)");
  });

  test("invalid input throws", () => {
    expect(() => NumberInterval.parse("1,5")).toThrow();
    expect(() => NumberInterval.parse("[x,5]")).toThrow();
  });
});

describe("parseInterval (standalone)", () => {
  test("parses via the domain and round-trips", () => {
    expect(parseInterval(numberDomain, "[1,5)").toString()).toBe("[1,5)");
    expect(parseInterval(numberDomain, "  (-Infinity,5]  ").toString()).toBe("(-Infinity,5]"); // trims
  });

  test("lower ≥ upper → empty", () => {
    expect(parseInterval(numberDomain, "[5,1]").isEmpty).toBe(true);
    expect(parseInterval(numberDomain, "(3,3)").isEmpty).toBe(true);
  });

  test("a domain without parse() throws", () => {
    const noParse: IntervalDomain<number> = {
      name: "no-parse",
      compare: (a, b) => Math.sign(a - b),
    };
    expect(() => parseInterval(noParse, "[1,5]")).toThrow(/has no parse/);
  });

  test("malformed strings throw with a useful message", () => {
    expect(() => parseInterval(numberDomain, "[15]")).toThrow(/missing comma/);
    expect(() => parseInterval(numberDomain, "1,5")).toThrow(/must start with/);
    expect(() => parseInterval(numberDomain, "[1,5>")).toThrow(/must start with/);
  });
});

describe("Interval.of / Interval.blank (low-level builders)", () => {
  test("of() builds from raw bounds", () => {
    const i = Interval.of(
      numberDomain,
      { unbounded: false, value: 1, closed: true },
      { unbounded: false, value: 5, closed: false },
    );
    expect(i.toString()).toBe("[1,5)");
  });

  test("of() with lower ≥ upper collapses to empty", () => {
    const i = Interval.of(
      numberDomain,
      { unbounded: false, value: 5, closed: true },
      { unbounded: false, value: 1, closed: true },
    );
    expect(i.isEmpty).toBe(true);
  });

  test("blank() is the empty interval", () => {
    expect(Interval.blank(numberDomain).isEmpty).toBe(true);
    expect(Interval.blank(numberDomain).toString()).toBe("∅");
  });

  test("the constructor is protected (use of/bound class)", () => {
    // @ts-expect-error — Interval's constructor is protected
    const direct = new Interval(
      numberDomain,
      { unbounded: true, closed: false },
      { unbounded: true, closed: false },
      true,
    );
    expect(direct).toBeInstanceOf(Interval);
  });
});

describe("intersection / overlaps", () => {
  test("overlapping", () => {
    expect(NumberInterval.closed(0, 5).intersection(NumberInterval.closed(3, 8)).toString()).toBe(
      "[3,5]",
    );
  });

  test("disjoint → empty", () => {
    expect(NumberInterval.closed(0, 2).intersection(NumberInterval.closed(5, 8)).isEmpty).toBe(
      true,
    );
    expect(NumberInterval.closed(0, 2).overlaps(NumberInterval.closed(5, 8))).toBe(false);
  });

  test("touching closed/open does not overlap but is adjacent", () => {
    const a = NumberInterval.closed(0, 5);
    const b = NumberInterval.open(5, 10);
    expect(a.overlaps(b)).toBe(false);
    expect(a.isAdjacent(b)).toBe(true);
    expect(a.isConnected(b)).toBe(true);
  });
});

describe("union — continuous vs discrete adjacency", () => {
  test("continuous: closed ∪ open at touch point merges", () => {
    expect(NumberInterval.closed(1, 5).union(NumberInterval.open(5, 10))?.toString()).toBe(
      "[1,10)",
    );
  });

  test("continuous: open ∪ open at the same point has a hole → null", () => {
    expect(NumberInterval.open(1, 5).union(NumberInterval.open(5, 10))).toBeNull();
  });

  test("continuous: integer-looking gap is NOT merged", () => {
    expect(NumberInterval.closed(1, 5).union(NumberInterval.closed(6, 10))).toBeNull();
  });

  test("discrete: [1,5] ∪ [6,10] = [1,10] (epsilon 1)", () => {
    expect(IntegerInterval.closed(1, 5).union(IntegerInterval.closed(6, 10))?.toString()).toBe(
      "[1,10]",
    );
  });

  test("discrete: gap of ≥2 is not merged", () => {
    expect(IntegerInterval.closed(1, 5).union(IntegerInterval.closed(8, 10))).toBeNull();
  });
});

describe("difference", () => {
  test("punch a hole → two pieces", () => {
    const parts = NumberInterval.closed(0, 10).difference(NumberInterval.closed(3, 5));
    expect(parts.map((p) => p.toString())).toEqual(["[0,3)", "(5,10]"]);
  });

  test("trim one side → one piece", () => {
    expect(
      NumberInterval.closed(0, 10)
        .difference(NumberInterval.atMost(3))
        .map((p) => p.toString()),
    ).toEqual(["(3,10]"]);
  });

  test("disjoint → unchanged", () => {
    expect(
      NumberInterval.closed(0, 2)
        .difference(NumberInterval.closed(5, 8))
        .map((p) => p.toString()),
    ).toEqual(["[0,2]"]);
  });

  test("fully covered → nothing", () => {
    expect(NumberInterval.closed(2, 4).difference(NumberInterval.closed(0, 10))).toEqual([]);
  });

  test("open/closed boundaries (dart_date examples)", () => {
    expect(
      NumberInterval.closed(3, 10)
        .difference(NumberInterval.open(4, 6))
        .map((p) => p.toString()),
    ).toEqual(["[3,4]", "[6,10]"]);
    expect(
      NumberInterval.closed(3, 10)
        .difference(NumberInterval.closed(4, 6))
        .map((p) => p.toString()),
    ).toEqual(["[3,4)", "(6,10]"]);
  });
});

describe("difference — continuous examples", () => {
  const cases: ReadonlyArray<readonly [string, string, string[]]> = [
    ["[3,10]", "(4,6)", ["[3,4]", "[6,10]"]],
    ["[3,10]", "[4,6]", ["[3,4)", "(6,10]"]],
    ["[3,10]", "[4,6)", ["[3,4)", "[6,10]"]],
    ["[3,10]", "(4,6]", ["[3,4]", "(6,10]"]],
    ["[0,10]", "[0,5]", ["(5,10]"]],
    ["[0,10]", "[5,10]", ["[0,5)"]],
    ["[0,10]", "[-5,5]", ["(5,10]"]],
    ["[0,10]", "(-Infinity,5]", ["(5,10]"]],
    ["[0,10]", "[5,+Infinity)", ["[0,5)"]],
    ["[0,10]", "[20,30]", ["[0,10]"]],
    ["[0,10]", "(-Infinity,+Infinity)", []],
    ["[0,10]", "[0,10]", []],
    ["(0,10)", "[5,5]", ["(0,5)", "(5,10)"]],
  ];

  for (const [a, b, want] of cases) {
    test(`${a} \\ ${b} = ${want.join(" ∪ ") || "∅"}`, () => {
      expect(
        N(a)
          .difference(N(b))
          .map((p) => p.toString()),
      ).toEqual(want);
    });
  }
});

describe("intersection — examples", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["[0,5]", "[3,8]", "[3,5]"],
    ["[0,5]", "[5,8]", "[5,5]"],
    ["[0,5]", "(5,8]", "∅"],
    ["(0,5)", "[2,3]", "[2,3]"],
    ["[0,10]", "(-Infinity,4)", "[0,4)"],
    ["[0,10]", "[4,+Infinity)", "[4,10]"],
    ["[0,5]", "[10,20]", "∅"],
    ["(-Infinity,+Infinity)", "[2,3]", "[2,3]"],
  ];

  for (const [a, b, want] of cases) {
    test(`${a} ∩ ${b} = ${want}`, () => {
      expect(N(a).intersection(N(b)).toString()).toBe(want);
    });
  }
});

describe("union — examples (null = gap)", () => {
  const cases: ReadonlyArray<readonly [string, string, string | null]> = [
    ["[0,5]", "[3,8]", "[0,8]"],
    ["[0,5]", "(5,8]", "[0,8]"],
    ["[0,5]", "[5,8]", "[0,8]"],
    ["[0,5]", "[6,8]", null],
    ["(0,5)", "(5,8)", null],
    ["(-Infinity,5)", "[5,+Infinity)", "(-Infinity,+Infinity)"],
    ["[0,5]", "[0,5]", "[0,5]"],
  ];

  for (const [a, b, want] of cases) {
    test(`${a} ∪ ${b} = ${want ?? "null"}`, () => {
      expect(N(a).union(N(b))?.toString() ?? null).toBe(want);
    });
  }
});

describe("gap / span — examples", () => {
  const gaps: ReadonlyArray<readonly [string, string, string | null]> = [
    ["[0,3]", "[6,10]", "(3,6)"],
    ["[0,3)", "[6,10]", "[3,6)"],
    ["[0,3]", "(6,10]", "(3,6]"],
    ["[0,3]", "[3,10]", null],
    ["[0,3]", "[2,10]", null],
  ];

  for (const [a, b, want] of gaps) {
    test(`gap(${a}, ${b}) = ${want ?? "null"}`, () => {
      expect(N(a).gap(N(b))?.toString() ?? null).toBe(want);
    });
  }

  test("span ignores the gap", () => {
    expect(N("[0,3]").span(N("[6,10]")).toString()).toBe("[0,10]");
    expect(N("(0,3)").span(N("[6,10)")).toString()).toBe("(0,10)");
  });
});

describe("symmetricDifference — examples", () => {
  const cases: ReadonlyArray<readonly [string, string, string[]]> = [
    ["[0,5]", "[3,8]", ["[0,3)", "(5,8]"]],
    ["[0,5]", "[5,10]", ["[0,5)", "(5,10]"]],
    ["[0,5]", "[6,10]", ["[0,5]", "[6,10]"]],
    ["[0,10]", "[3,6]", ["[0,3)", "(6,10]"]],
    ["[0,5]", "[0,5]", []],
  ];

  for (const [a, b, want] of cases) {
    test(`${a} △ ${b} = ${want.join(" ∪ ") || "∅"}`, () => {
      expect(
        N(a)
          .symmetricDifference(N(b))
          .map((p) => p.toString()),
      ).toEqual(want);
    });
  }
});

describe("symmetricDifference / gap / span", () => {
  test("symmetric difference", () => {
    expect(
      NumberInterval.closed(0, 5)
        .symmetricDifference(NumberInterval.closed(3, 8))
        .map((p) => p.toString()),
    ).toEqual(["[0,3)", "(5,8]"]);
  });

  test("gap between disjoint", () => {
    expect(NumberInterval.closed(0, 3).gap(NumberInterval.closed(6, 10))?.toString()).toBe("(3,6)");
    expect(NumberInterval.closed(0, 3).gap(NumberInterval.closed(2, 10))).toBeNull();
  });

  test("span ignores the gap", () => {
    expect(NumberInterval.closed(0, 3).span(NumberInterval.closed(6, 10)).toString()).toBe(
      "[0,10]",
    );
  });
});

describe("set ops with the empty interval", () => {
  const a = N("[1,5]");
  const empty = NumberInterval.empty();

  test("union absorbs empty", () => {
    expect(empty.union(a)?.toString()).toBe("[1,5]");
    expect(a.union(empty)?.toString()).toBe("[1,5]");
  });

  test("span absorbs empty", () => {
    expect(empty.span(a).toString()).toBe("[1,5]");
    expect(a.span(empty).toString()).toBe("[1,5]");
  });

  test("span is commutative regardless of argument order", () => {
    expect(N("[0,3]").span(N("[6,10]")).toString()).toBe("[0,10]");
    expect(N("[6,10]").span(N("[0,3]")).toString()).toBe("[0,10]");
  });

  test("intersection with empty is empty", () => {
    expect(a.intersection(empty).isEmpty).toBe(true);
    expect(empty.intersection(a).isEmpty).toBe(true);
  });

  test("difference and predicates treat empty correctly", () => {
    expect(a.difference(empty).map((p) => p.toString())).toEqual(["[1,5]"]);
    expect(empty.difference(a)).toEqual([]);
    expect(empty.isConnected(a)).toBe(false);
    expect(empty.isBefore(a)).toBe(false);
    expect(empty.isAdjacent(a)).toBe(false);
    expect(empty.overlaps(a)).toBe(false);
    expect(a.encloses(empty)).toBe(true);
  });
});

describe("predicates — examples", () => {
  test("isSubsetOf / isSupersetOf / encloses", () => {
    expect(N("[2,8]").isSubsetOf(N("[0,10]"))).toBe(true);
    expect(N("(2,8)").isSubsetOf(N("[2,8]"))).toBe(true);
    expect(N("[2,8]").isSubsetOf(N("(2,8)"))).toBe(false);
    expect(N("[0,10]").isSupersetOf(N("[2,8]"))).toBe(true);
    expect(N("[0,10]").isSubsetOf(N("[0,10]"))).toBe(true);
    expect(N("[2,8]").isSubsetOf(N("(-Infinity,+Infinity)"))).toBe(true);
  });

  test("isDisjointFrom / overlaps / isAdjacent", () => {
    expect(N("[0,2]").isDisjointFrom(N("[5,8]"))).toBe(true);
    expect(N("[0,5]").isDisjointFrom(N("(5,8]"))).toBe(true);
    expect(N("[0,5]").isDisjointFrom(N("[5,8]"))).toBe(false);
    expect(N("[0,5]").overlaps(N("[3,8]"))).toBe(true);
    expect(N("[0,5]").isAdjacent(N("(5,8]"))).toBe(true);
    expect(N("[0,5]").isAdjacent(N("[3,8]"))).toBe(false);
  });

  test("isBefore / isAfter", () => {
    expect(N("[0,3]").isBefore(N("[6,10]"))).toBe(true);
    expect(N("[6,10]").isAfter(N("[0,3]"))).toBe(true);
    expect(N("[0,5]").isBefore(N("[3,8]"))).toBe(false);
  });
});

describe("Set-composition predicates", () => {
  test("isSubsetOf / isSupersetOf", () => {
    const big = NumberInterval.closed(0, 10);
    const small = NumberInterval.closed(2, 8);
    expect(small.isSubsetOf(big)).toBe(true);
    expect(big.isSupersetOf(small)).toBe(true);
    expect(big.isSubsetOf(small)).toBe(false);
    expect(small.isSubsetOf(NumberInterval.closed(2, 8))).toBe(true); // reflexive
  });

  test("isDisjointFrom", () => {
    expect(NumberInterval.closed(0, 2).isDisjointFrom(NumberInterval.closed(5, 8))).toBe(true);
    expect(NumberInterval.closed(0, 5).isDisjointFrom(NumberInterval.closed(3, 8))).toBe(false);
    expect(NumberInterval.closed(0, 5).isDisjointFrom(NumberInterval.open(5, 8))).toBe(true); // touch, no overlap
  });
});

describe("encloses with unbounded sides", () => {
  test("full and half-bounded enclosure", () => {
    expect(NumberInterval.all().encloses(N("[1,5]"))).toBe(true);
    expect(N("(-Infinity,5]").encloses(N("[1,5]"))).toBe(true);
    expect(N("(-Infinity,5]").encloses(N("[1,6]"))).toBe(false);
    expect(N("[0,10]").encloses(NumberInterval.all())).toBe(false);
  });
});

describe("middle / withStart / withEnd", () => {
  test("middle (midpoint)", () => {
    expect(NumberInterval.closed(0, 10).middle()).toBe(5);
    expect(NumberInterval.atLeast(0).middle()).toBeNull();
    expect(IntegerInterval.closed(1, 5).middle()).toBe(3); // {1..5} → 3
  });

  test("withStart / withEnd return a new interval", () => {
    expect(NumberInterval.closed(0, 10).withStart(2, true).toString()).toBe("[2,10]");
    expect(NumberInterval.closed(0, 10).withEnd(5, false).toString()).toBe("[0,5)");
  });

  test("withStart / withEnd that move past the other end yield empty", () => {
    expect(N("[1,5]").withStart(10, true).isEmpty).toBe(true);
    expect(N("[1,5]").withEnd(0, true).isEmpty).toBe(true);
    expect(N("[1,5]").withStart(2, false).toString()).toBe("(2,5]");
    expect(N("[1,5]").withEnd(4, false).toString()).toBe("[1,4)");
  });
});

describe("bound accessors", () => {
  test("hasLowerBound / hasUpperBound / lowerValue / upperValue", () => {
    const finite = N("[1,5]");
    expect(finite.hasLowerBound()).toBe(true);
    expect(finite.hasUpperBound()).toBe(true);
    expect(finite.lowerValue()).toBe(1);
    expect(finite.upperValue()).toBe(5);

    const halfOpen = N("(-Infinity,5]");
    expect(halfOpen.hasLowerBound()).toBe(false);
    expect(halfOpen.lowerValue()).toBeNull();
    expect(halfOpen.hasUpperBound()).toBe(true);
    expect(halfOpen.upperValue()).toBe(5);

    const empty = NumberInterval.empty();
    expect(empty.hasLowerBound()).toBe(false);
    expect(empty.hasUpperBound()).toBe(false);
    expect(empty.lowerValue()).toBeNull();
    expect(empty.upperValue()).toBeNull();
  });

  test("discrete bounds reflect the canonical [closed, open) storage", () => {
    const i = IntegerInterval.closed(1, 5); // stored as [1,6)
    expect(i.lowerValue()).toBe(1);
    expect(i.upperValue()).toBe(6);
    expect(i.toString()).toBe("[1,5]"); // display hides the canonical form
  });
});

describe("format with custom ±∞ tokens", () => {
  test("substitutes the unbounded sides only", () => {
    expect(N("(-Infinity,5]").format({ negativeInfinity: "-∞" })).toBe("(-∞,5]");
    expect(N("[0,+Infinity)").format({ positiveInfinity: "∞" })).toBe("[0,∞)");
    expect(
      N("(-Infinity,+Infinity)").format({ negativeInfinity: "-∞", positiveInfinity: "∞" }),
    ).toBe("(-∞,∞)");
  });

  test("finite intervals ignore the tokens", () => {
    expect(N("[1,5]").format({ negativeInfinity: "x", positiveInfinity: "y" })).toBe("[1,5]");
  });

  test("toString() === format() with defaults", () => {
    const i = N("(-Infinity,5]");
    expect(i.toString()).toBe(i.format());
  });
});

describe("predicates / measure / equality", () => {
  test("isPoint / isEmpty / isFull", () => {
    expect(NumberInterval.point(3).isPoint).toBe(true);
    expect(NumberInterval.closed(1, 5).isPoint).toBe(false);
    expect(NumberInterval.open(3, 3).isEmpty).toBe(true);
    expect(NumberInterval.all().isFull).toBe(true);
    expect(IntegerInterval.point(3).isPoint).toBe(true);
  });

  test("isDiscrete reflects the domain", () => {
    expect(IntegerInterval.closed(1, 5).isDiscrete).toBe(true);
    expect(BigIntInterval.closed(1n, 5n).isDiscrete).toBe(true);
    expect(NumberInterval.closed(1, 5).isDiscrete).toBe(false);
    expect(DateInterval.all().isDiscrete).toBe(false);
  });

  test("encloses", () => {
    expect(NumberInterval.closed(0, 10).encloses(NumberInterval.closed(2, 8))).toBe(true);
    expect(NumberInterval.closed(0, 10).encloses(NumberInterval.closed(2, 12))).toBe(false);
    expect(NumberInterval.closed(0, 10).encloses(NumberInterval.empty())).toBe(true);
  });

  test("length (null when unbounded)", () => {
    expect(NumberInterval.closed(1, 5).length()).toBe(4);
    expect(IntegerInterval.closed(1, 5).length()).toBe(5); // count of {1..5}
    expect(NumberInterval.atLeast(0).length()).toBeNull();
    expect(NumberInterval.empty().length()).toBe(0);
  });

  test("equals canonicalizes discrete bounds", () => {
    expect(IntegerInterval.openClosed(0, 5).equals(IntegerInterval.closed(1, 5))).toBe(true);
    expect(IntegerInterval.openClosed(0, 5).toString()).toBe("[1,5]");
    expect(NumberInterval.closed(1, 5).equals(NumberInterval.closed(1, 5))).toBe(true);
    expect(NumberInterval.closed(1, 5).equals(NumberInterval.open(1, 5))).toBe(false);
  });

  test("equals across domains is never true (even both empty)", () => {
    // both are Interval<number>, so this type-checks
    expect(NumberInterval.closed(1, 5).equals(IntegerInterval.closed(1, 5))).toBe(false);
    expect(NumberInterval.empty().equals(IntegerInterval.empty())).toBe(false);
    expect(NumberInterval.empty().equals(NumberInterval.empty())).toBe(true);
  });

  test("equals over matching unbounded bounds", () => {
    expect(N("(-Infinity,5]").equals(N("(-Infinity,5]"))).toBe(true);
    expect(N("(-Infinity,5]").equals(N("(-Infinity,6]"))).toBe(false);
    expect(NumberInterval.all().equals(NumberInterval.all())).toBe(true);
    expect(N("[0,+Infinity)").equals(N("[0,+Infinity)"))).toBe(true);
  });
});

describe("open-ended factories", () => {
  test("greaterThan / lessThan produce open bounds", () => {
    expect(NumberInterval.greaterThan(5).toString()).toBe("(5,+Infinity)");
    expect(NumberInterval.greaterThan(5).contains(5)).toBe(false);
    expect(NumberInterval.greaterThan(5).contains(6)).toBe(true);
    expect(NumberInterval.lessThan(5).toString()).toBe("(-Infinity,5)");
    expect(NumberInterval.lessThan(5).contains(5)).toBe(false);
    expect(NumberInterval.lessThan(5).contains(4)).toBe(true);
  });
});

describe("isPoint across domains", () => {
  test("continuous point vs degenerate open", () => {
    expect(NumberInterval.point(3).isPoint).toBe(true);
    expect(NumberInterval.open(3, 3).isPoint).toBe(false); // empty, not a point
    expect(NumberInterval.closed(1, 5).isPoint).toBe(false);
  });

  test("discrete single-element intervals are points", () => {
    expect(IntegerInterval.closedOpen(3, 4).isPoint).toBe(true); // {3}
    expect(IntegerInterval.closed(3, 3).isPoint).toBe(true);
    expect(IntegerInterval.closed(3, 5).isPoint).toBe(false); // {3,4,5}
  });
});

describe("mergeIntervals", () => {
  test("merges overlapping and keeps gaps (continuous)", () => {
    const merged = mergeIntervals(numberDomain, [N("[1,3]"), N("[2,5]"), N("[10,12]")]);
    expect(merged.map((p) => p.toString())).toEqual(["[1,5]", "[10,12]"]);
  });

  test("is order-independent (sorts by lower bound)", () => {
    const merged = mergeIntervals(numberDomain, [N("[10,12]"), N("[2,5]"), N("[1,3]")]);
    expect(merged.map((p) => p.toString())).toEqual(["[1,5]", "[10,12]"]);
  });

  test("drops empty intervals", () => {
    const merged = mergeIntervals(numberDomain, [
      NumberInterval.empty(),
      N("[1,3]"),
      NumberInterval.empty(),
    ]);
    expect(merged.map((p) => p.toString())).toEqual(["[1,3]"]);
  });

  test("empty input → empty result", () => {
    expect(mergeIntervals(numberDomain, [])).toEqual([]);
  });

  test("discrete: epsilon-adjacent ranges merge gap-free", () => {
    const merged = mergeIntervals(bigIntDomain, [
      BigIntInterval.closed(1n, 5n),
      BigIntInterval.closed(6n, 10n),
      BigIntInterval.closed(20n, 25n),
    ]);
    expect(merged.map((p) => p.toString())).toEqual(["[1,10]", "[20,25]"]);
  });
});

describe("custom domains via defineIntervalType", () => {
  // A discrete money domain (1-cent epsilon) — adjacent ranges merge.
  const centsDomain: IntervalDomain<number> = {
    name: "cents",
    compare: (a, b) => Math.sign(a - b),
    next: (v) => v + 1,
    prev: (v) => v - 1,
    measure: (a, b) => b - a,
    add: (v, d) => v + Math.trunc(d),
    format: (v) => String(v),
    parse: (t) => Number(t),
  };
  const CentsInterval = defineIntervalType(centsDomain);

  test("discrete custom domain behaves like the built-ins", () => {
    expect(CentsInterval.closed(100, 105).length()).toBe(6); // {100..105}
    expect(CentsInterval.closed(100, 105).isDiscrete).toBe(true);
    expect(CentsInterval.closed(100, 105).union(CentsInterval.closed(106, 110))?.toString()).toBe(
      "[100,110]",
    );
    expect(CentsInterval.parse("[100,105]").toString()).toBe("[100,105]");
  });

  test("instances are instanceof the bound class and Interval", () => {
    const r = CentsInterval.closed(0, 10);
    expect(r).toBeInstanceOf(CentsInterval);
    expect(r).toBeInstanceOf(Interval);
  });

  // The minimum viable domain: only name + compare.
  const bareDomain: IntervalDomain<number> = { name: "bare", compare: (a, b) => Math.sign(a - b) };
  const BareInterval = defineIntervalType(bareDomain);

  test("a compare-only domain still supports membership", () => {
    expect(BareInterval.closed(1, 5).contains(3)).toBe(true);
    expect(BareInterval.closed(1, 5).contains(6)).toBe(false);
    expect(BareInterval.closed(1, 5).isDiscrete).toBe(false);
  });

  test("optional hooks degrade gracefully when absent", () => {
    expect(BareInterval.closed(1, 5).length()).toBeNull(); // no measure
    expect(BareInterval.closed(1, 5).middle()).toBeNull(); // no add/measure
    expect(BareInterval.closed(1, 5).toString()).toBe("[1,5]"); // String() fallback
  });

  test("length/center constructors require add()", () => {
    expect(() => BareInterval.fromStart(1, 5)).toThrow(/has no add/);
    expect(() => BareInterval.fromEnd(5, 5)).toThrow(/has no add/);
    expect(() => BareInterval.fromCenter(5, 4)).toThrow(/has no add/);
  });

  test("parse() requires a domain parse()", () => {
    expect(() => BareInterval.parse("[1,5]")).toThrow(/has no parse/);
  });
});

describe("duration-style constructors", () => {
  test("fromStart / fromEnd / fromCenter (half-open)", () => {
    expect(NumberInterval.fromStart(10, 5).toString()).toBe("[10,15)");
    expect(NumberInterval.fromEnd(15, 5).toString()).toBe("[10,15)");
    expect(NumberInterval.fromCenter(10, 4).toString()).toBe("[8,12)");
  });
});

describe("new-able bound class (spec constructor)", () => {
  test("spec with explicit brackets", () => {
    const range = new NumberInterval({ start: 5, startClose: true, end: 6, endClose: false });
    expect(range.toString()).toBe("[5,6)");
    expect(range.contains(5)).toBe(true);
    expect(range.contains(6)).toBe(false);
  });

  test("explicit closed-closed and half-open", () => {
    expect(
      new NumberInterval({ start: 1, startClose: true, end: 5, endClose: true }).toString(),
    ).toBe("[1,5]");
    expect(
      new NumberInterval({ start: 1, startClose: true, end: 5, endClose: false }).toString(),
    ).toBe("[1,5)");
  });

  test("omitting a side is unbounded", () => {
    expect(new NumberInterval({ end: 5, endClose: false }).toString()).toBe("(-Infinity,5)");
    expect(new NumberInterval({ start: 5, startClose: false }).toString()).toBe("(5,+Infinity)");
    expect(new NumberInterval().toString()).toBe("(-Infinity,+Infinity)");
  });

  test("a bounded side requires its close flag (compile-time)", () => {
    // @ts-expect-error — startClose is mandatory once start is provided
    const bad = new NumberInterval({ start: 1, end: 5, endClose: false });
    expect(bad).toBeDefined();
  });

  test("instances are instanceof both the bound class and Interval", () => {
    const a = new NumberInterval({ start: 0, startClose: true, end: 5, endClose: true });
    const b = NumberInterval.closedOpen(5, 10);
    expect(a instanceof NumberInterval).toBe(true);
    expect(a instanceof Interval).toBe(true);
    expect(b instanceof NumberInterval).toBe(true);

    // Operations interoperate and return base Interval (still instanceof Interval).
    const merged = a.union(b);
    expect(merged instanceof Interval).toBe(true);
    expect(merged?.toString()).toBe("[0,10)");
  });
});
