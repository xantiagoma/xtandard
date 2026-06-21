import { describe, expect, test } from "vitest";

import type { BoundIntervalType } from "../src/interval";
import {
  BigIntInterval,
  createOrdinalInterval,
  DateInterval,
  IntegerInterval,
  NumberInterval,
  StringInterval,
  stringDomain,
} from "../src/interval-domains";

// Concise builders from strings, for the example-table tests.
const N = (s: string) => NumberInterval.parse(s);
const I = (s: string) => IntegerInterval.parse(s);

describe("numberDomain (continuous)", () => {
  test("parse/format + measure", () => {
    expect(NumberInterval.parse("[1.5,3.5)").toString()).toBe("[1.5,3.5)");
    expect(NumberInterval.closed(1.5, 3.5).length()).toBe(2);
  });

  test("NaN edge cases — rejected by contains, rejected by parse", () => {
    expect(NumberInterval.all().contains(NaN)).toBe(false);
    expect(NumberInterval.closed(0, 10).contains(NaN)).toBe(false);
    expect(() => NumberInterval.parse("[NaN,5]")).toThrow();
    expect(() => NumberInterval.parse("[lala,5]")).toThrow();
  });

  test("±Infinity are valid members on the extended line (closed brackets)", () => {
    expect(NumberInterval.parse("[-Infinity,+Infinity]").contains(Infinity)).toBe(true);
    expect(NumberInterval.parse("[-Infinity,+Infinity]").contains(-Infinity)).toBe(true);
    expect(NumberInterval.parse("(-Infinity,+Infinity)").contains(Infinity)).toBe(false);
  });
});

describe("contains rejects invalid / out-of-range values (isValid)", () => {
  test("±Infinity excluded from open-infinity (factory) and finite intervals", () => {
    // Factories produce OPEN infinity; closed ±∞ via parse is covered elsewhere.
    expect(NumberInterval.all().contains(Infinity)).toBe(false);
    expect(NumberInterval.all().contains(-Infinity)).toBe(false);
    expect(NumberInterval.atLeast(0).contains(Infinity)).toBe(false);
    expect(NumberInterval.atMost(5).contains(-Infinity)).toBe(false);
    expect(NumberInterval.closed(0, 5).contains(Infinity)).toBe(false);
  });

  test("NaN is never a member", () => {
    expect(NumberInterval.all().contains(NaN)).toBe(false);
    expect(NumberInterval.closed(0, 5).contains(NaN)).toBe(false);
    expect(IntegerInterval.all().contains(NaN)).toBe(false);
  });

  test("integer domain rejects non-integers", () => {
    expect(IntegerInterval.closed(0, 10).contains(3.5)).toBe(false);
    expect(IntegerInterval.closed(0, 10).contains(3)).toBe(true);
  });
});

describe("±Infinity as a finite endpoint value (extended line)", () => {
  test("a closed Infinity bound is formatted via the domain, and is a member", () => {
    // Unlike the unbounded `+Infinity` token, here Infinity is the literal bound value.
    expect(NumberInterval.closed(0, Infinity).toString()).toBe("[0,+Infinity]");
    expect(NumberInterval.closed(-Infinity, 0).toString()).toBe("[-Infinity,0]");
    expect(NumberInterval.closed(0, Infinity).contains(Infinity)).toBe(true);
    expect(NumberInterval.closed(-Infinity, 0).contains(-Infinity)).toBe(true);
  });
});

describe("unbounded (±Infinity) — number is the extended real line", () => {
  test("the bracket on ±∞ is meaningful", () => {
    // ±Infinity ARE values for `number`, so a closed bracket includes them.
    expect(N("[-Infinity,5]").toString()).toBe("[-Infinity,5]");
    expect(N("[3,+Infinity]").toString()).toBe("[3,+Infinity]");
    expect(N("[-Infinity,+Infinity]").toString()).toBe("[-Infinity,+Infinity]");
    expect(N("(-Infinity,+Infinity)").isFull).toBe(true);
    expect(N("[-Infinity,+Infinity]").isFull).toBe(true);
  });

  test("±∞ membership follows the bracket (the extended-line table)", () => {
    expect(N("[-Infinity,5]").contains(-Infinity)).toBe(true);
    expect(N("[-Infinity,5]").contains(Infinity)).toBe(false);
    expect(N("[-Infinity,5]").contains(5)).toBe(true);

    expect(N("(-Infinity,5)").contains(-Infinity)).toBe(false);
    expect(N("(-Infinity,5)").contains(Infinity)).toBe(false);
    expect(N("(-Infinity,5)").contains(5)).toBe(false);
    expect(N("(-Infinity,5)").contains(4)).toBe(true);

    expect(N("[3,+Infinity]").contains(Infinity)).toBe(true);
    expect(N("[3,+Infinity)").contains(Infinity)).toBe(false);

    // factories (atLeast/atMost/all) produce OPEN infinity → ∞ excluded
    expect(NumberInterval.all().contains(Infinity)).toBe(false);
    expect(NumberInterval.atMost(5).contains(-Infinity)).toBe(false);
  });

  const diffs: ReadonlyArray<readonly [string, string, string[]]> = [
    // The classic complement: ℝ minus a closed interval → two open-ended pieces.
    ["(-Infinity,+Infinity)", "[3,4]", ["(-Infinity,3)", "(4,+Infinity)"]],
    // Removing an OPEN interval keeps its endpoints.
    ["(-Infinity,+Infinity)", "(3,4)", ["(-Infinity,3]", "[4,+Infinity)"]],
    ["(-Infinity,+Infinity)", "[3,4)", ["(-Infinity,3)", "[4,+Infinity)"]],
    ["(-Infinity,5]", "[3,4]", ["(-Infinity,3)", "(4,5]"]],
    ["[3,+Infinity)", "[3,4]", ["(4,+Infinity)"]],
    ["(-Infinity,+Infinity)", "(-Infinity,0]", ["(0,+Infinity)"]],
    ["(-Infinity,+Infinity)", "[0,+Infinity)", ["(-Infinity,0)"]],
    ["(-Infinity,+Infinity)", "(-Infinity,+Infinity)", []],
  ];

  for (const [a, b, want] of diffs) {
    test(`${a} \\ ${b} = ${want.join(" ∪ ") || "∅"}`, () => {
      expect(
        N(a)
          .difference(N(b))
          .map((p) => p.toString()),
      ).toEqual(want);
    });
  }

  test("unbounded unions / intersections", () => {
    expect(N("(-Infinity,5)").union(N("[5,+Infinity)"))?.toString()).toBe("(-Infinity,+Infinity)");
    expect(N("(-Infinity,5)").union(N("(5,+Infinity)"))).toBeNull(); // hole at 5
    expect(N("(-Infinity,5]").intersection(N("[5,+Infinity)")).toString()).toBe("[5,5]");
    expect(N("(-Infinity,3)").gap(N("(4,+Infinity)"))?.toString()).toBe("[3,4]");
  });

  test("length of an unbounded interval is null", () => {
    expect(N("(-Infinity,5]").length()).toBeNull();
    expect(N("[0,+Infinity)").length()).toBeNull();
    expect(N("(-Infinity,+Infinity)").length()).toBeNull();
  });
});

describe("integerDomain (discrete)", () => {
  test("canonical closed-closed display + count", () => {
    expect(IntegerInterval.closedOpen(1, 5).toString()).toBe("[1,4]"); // {1,2,3,4}
    expect(IntegerInterval.closed(1, 4).length()).toBe(4);
  });

  test("adjacency merge", () => {
    expect(IntegerInterval.closed(1, 3).union(IntegerInterval.closed(4, 6))?.toString()).toBe(
      "[1,6]",
    );
  });

  test("parse rejects a non-integer endpoint", () => {
    expect(() => IntegerInterval.parse("[3.5,5]")).toThrow(/invalid integer/);
  });
});

describe("integer (discrete, ε1) — examples", () => {
  test("union merges epsilon-adjacent ranges", () => {
    expect(I("[1,5]").union(I("[6,10]"))?.toString()).toBe("[1,10]");
    expect(I("[1,5]").union(I("[7,10]"))).toBeNull(); // gap at 6
  });

  test("difference removes integer sets", () => {
    expect(
      I("[1,10]")
        .difference(I("[4,6]"))
        .map((p) => p.toString()),
    ).toEqual(["[1,3]", "[7,10]"]); // remove {4,5,6}
    expect(
      I("[1,10]")
        .difference(I("(4,6)"))
        .map((p) => p.toString()),
    ).toEqual(["[1,4]", "[6,10]"]); // (4,6) = {5}
  });

  test("intersection + count", () => {
    expect(I("[1,10]").intersection(I("[5,20]")).toString()).toBe("[5,10]");
    expect(I("[5,10]").length()).toBe(6); // {5,6,7,8,9,10}
  });

  test("(0,5] == [1,5] (canonical) and gap", () => {
    expect(I("(0,5]").equals(I("[1,5]"))).toBe(true);
    expect(I("[1,3]").gap(I("[7,9]"))?.toString()).toBe("[4,6]");
  });
});

describe("bigIntDomain (discrete)", () => {
  test("parse/format huge values", () => {
    const i = BigIntInterval.parse("[10000000000000000000,10000000000000000005]");
    expect(i.toString()).toBe("[10000000000000000000,10000000000000000005]");
    expect(i.length()).toBe(6);
  });

  test("no ±∞ value → unbounded is always OPEN (bracket on Inf ignored)", () => {
    // bigint has no infinity value, so `[-Infinity` can't include it → forced open.
    expect(BigIntInterval.parse("[-Infinity,10]").toString()).toBe("(-Infinity,10]");
    expect(BigIntInterval.parse("[5,+Infinity]").toString()).toBe("[5,+Infinity)");
  });

  test("set algebra and midpoint", () => {
    expect(BigIntInterval.closed(1n, 5n).union(BigIntInterval.closed(6n, 10n))?.toString()).toBe(
      "[1,10]",
    );
    expect(
      BigIntInterval.closed(1n, 10n)
        .difference(BigIntInterval.closed(4n, 6n))
        .map((p) => p.toString()),
    ).toEqual(["[1,3]", "[7,10]"]);
    expect(
      BigIntInterval.closed(1n, 10n).intersection(BigIntInterval.closed(5n, 20n)).toString(),
    ).toBe("[5,10]");
    expect(BigIntInterval.closed(1n, 5n).middle()).toBe(3n);
  });
});

describe("dateDomain (continuous)", () => {
  test("ISO parse/format + ms length", () => {
    const i = DateInterval.parse("[2026-01-01T00:00:00.000Z,2026-01-01T01:00:00.000Z)");
    expect(i.toString()).toBe("[2026-01-01T00:00:00.000Z,2026-01-01T01:00:00.000Z)");
    expect(i.length()).toBe(60 * 60 * 1000);
    expect(i.contains(new Date("2026-01-01T00:30:00Z"))).toBe(true);
    expect(i.contains(new Date("2026-01-01T01:00:00Z"))).toBe(false);
  });

  test("Invalid Date edge cases", () => {
    const i = DateInterval.parse("[2026-01-01T00:00:00.000Z,2026-01-02T00:00:00.000Z)");
    // `new Date("lala")` → Invalid Date (getTime() is NaN) → never a member.
    expect(i.contains(new Date("lala"))).toBe(false);
    // An invalid date string as an endpoint is rejected at parse.
    expect(() => DateInterval.parse("[lala,2026-01-02T00:00:00.000Z)")).toThrow();
  });

  test("no ±∞ Date value → unbounded is always OPEN", () => {
    expect(DateInterval.parse("[-Infinity,2026-01-02T00:00:00.000Z)").toString()).toBe(
      "(-Infinity,2026-01-02T00:00:00.000Z)",
    );
  });
});

// --- cross-domain operation parity ------------------------------------------
// The same operation matrix NumberInterval gets, run against every other built-in
// domain so coverage is balanced, not Number-heavy.

/**
 * Shared battery for the two discrete integer-like domains. `v` maps a plain
 * number to the domain's value type, and both `number` and `bigint` render the
 * same numeric `toString()`, so the expected strings are identical for each.
 */
function runDiscreteParity<T>(label: string, Ctor: BoundIntervalType<T>, v: (n: number) => T) {
  describe(`${label} (discrete) — operation parity`, () => {
    const closed = (a: number, b: number) => Ctor.closed(v(a), v(b));

    test("contains respects bounds; the domain rejects non-members", () => {
      const i = closed(1, 5);
      expect(i.contains(v(1))).toBe(true);
      expect(i.contains(v(5))).toBe(true);
      expect(i.contains(v(0))).toBe(false);
      expect(i.contains(v(6))).toBe(false);
      expect(i.contains(v(3))).toBe(true);
      expect(i.isDiscrete).toBe(true);
    });

    test("union merges epsilon-adjacent ranges; a real gap stays null", () => {
      expect(closed(1, 5).union(closed(6, 10))?.toString()).toBe("[1,10]");
      expect(closed(1, 5).union(closed(8, 10))).toBeNull();
    });

    test("intersection / difference / symmetricDifference", () => {
      expect(closed(1, 10).intersection(closed(5, 20)).toString()).toBe("[5,10]");
      expect(
        closed(1, 10)
          .difference(closed(4, 6))
          .map((p) => p.toString()),
      ).toEqual(["[1,3]", "[7,10]"]);
      expect(
        closed(1, 5)
          .symmetricDifference(closed(3, 8))
          .map((p) => p.toString()),
      ).toEqual(["[1,2]", "[6,8]"]);
    });

    test("gap / span", () => {
      expect(closed(1, 3).gap(closed(7, 9))?.toString()).toBe("[4,6]");
      expect(closed(1, 3).span(closed(7, 9)).toString()).toBe("[1,9]");
    });

    test("predicates: encloses / overlaps / isBefore / isAdjacent / isPoint", () => {
      expect(closed(0, 10).encloses(closed(2, 8))).toBe(true);
      expect(closed(0, 10).encloses(closed(2, 12))).toBe(false);
      expect(closed(0, 5).overlaps(closed(3, 8))).toBe(true);
      expect(closed(0, 2).overlaps(closed(5, 8))).toBe(false);
      expect(closed(0, 3).isBefore(closed(6, 10))).toBe(true);
      expect(closed(1, 5).isAdjacent(closed(6, 10))).toBe(true); // epsilon-adjacent
      expect(Ctor.point(v(3)).isPoint).toBe(true);
      expect(closed(1, 5).isPoint).toBe(false);
    });

    test("length counts elements; middle is the median; unbounded length is null", () => {
      expect(closed(1, 5).length()).toBe(5); // {1,2,3,4,5}
      expect(closed(1, 5).middle()).toBe(v(3));
      expect(Ctor.atLeast(v(0)).length()).toBeNull();
    });

    test("parse round-trips; open-ended factories use the canonical ±Infinity token", () => {
      expect(Ctor.parse("[1,10]").toString()).toBe("[1,10]");
      expect(Ctor.atLeast(v(0)).toString()).toBe("[0,+Infinity)");
      expect(Ctor.atMost(v(5)).toString()).toBe("(-Infinity,5]");
    });

    test("withStart / withEnd return adjusted intervals", () => {
      expect(closed(1, 10).withStart(v(3), true).toString()).toBe("[3,10]");
      expect(closed(1, 10).withEnd(v(8), true).toString()).toBe("[1,8]");
    });
  });
}

runDiscreteParity("IntegerInterval", IntegerInterval, (n) => n);
runDiscreteParity("BigIntInterval", BigIntInterval, (n) => BigInt(n));

describe("DateInterval (continuous) — operation parity", () => {
  const d = (n: number) => new Date(Date.UTC(2026, 0, n));
  const DAY = 24 * 60 * 60 * 1000;

  test("contains respects open/closed bounds", () => {
    expect(DateInterval.closed(d(1), d(5)).contains(d(3))).toBe(true);
    expect(DateInterval.closed(d(1), d(5)).contains(d(1))).toBe(true);
    expect(DateInterval.closed(d(1), d(5)).contains(d(5))).toBe(true);
    expect(DateInterval.closedOpen(d(1), d(5)).contains(d(5))).toBe(false);
    expect(DateInterval.closed(d(1), d(5)).contains(d(6))).toBe(false);
    expect(DateInterval.closed(d(1), d(5)).isDiscrete).toBe(false);
  });

  test("intersection clips; adjacent half-open ranges merge; a gap stays null", () => {
    expect(
      DateInterval.closed(d(1), d(5))
        .intersection(DateInterval.closed(d(3), d(8)))
        .equals(DateInterval.closed(d(3), d(5))),
    ).toBe(true);
    expect(
      DateInterval.closedOpen(d(1), d(5))
        .union(DateInterval.closedOpen(d(5), d(10)))
        ?.equals(DateInterval.closedOpen(d(1), d(10))),
    ).toBe(true);
    expect(DateInterval.closed(d(1), d(3)).union(DateInterval.closed(d(6), d(10)))).toBeNull(); // continuous gap
  });

  test("difference keeps the right open/closed boundaries", () => {
    const parts = DateInterval.closed(d(1), d(10)).difference(DateInterval.closed(d(4), d(6)));
    expect(parts.map((p) => p.toString())).toEqual([
      DateInterval.closedOpen(d(1), d(4)).toString(),
      DateInterval.openClosed(d(6), d(10)).toString(),
    ]);
  });

  test("gap / span", () => {
    expect(
      DateInterval.closed(d(1), d(3))
        .gap(DateInterval.closed(d(6), d(10)))
        ?.equals(DateInterval.open(d(3), d(6))),
    ).toBe(true);
    expect(
      DateInterval.closed(d(1), d(3))
        .span(DateInterval.closed(d(6), d(10)))
        .equals(DateInterval.closed(d(1), d(10))),
    ).toBe(true);
  });

  test("predicates: encloses / isBefore / overlaps", () => {
    expect(DateInterval.closed(d(1), d(10)).encloses(DateInterval.closed(d(3), d(6)))).toBe(true);
    expect(DateInterval.closed(d(1), d(3)).isBefore(DateInterval.closed(d(6), d(10)))).toBe(true);
    expect(DateInterval.closed(d(1), d(5)).overlaps(DateInterval.closed(d(3), d(8)))).toBe(true);
  });

  test("length is the ms span; middle is the midpoint instant", () => {
    expect(DateInterval.closedOpen(d(1), d(10)).length()).toBe(9 * DAY);
    expect(DateInterval.closed(d(1), d(5)).middle()?.getTime()).toBe(d(3).getTime());
    expect(DateInterval.atLeast(d(1)).length()).toBeNull();
  });

  test("parse round-trips via ISO; open-ended factories format with canonical ±Infinity", () => {
    const i = DateInterval.closed(d(1), d(5));
    expect(DateInterval.parse(i.toString()).equals(i)).toBe(true);
    expect(DateInterval.atLeast(d(1)).toString().endsWith(",+Infinity)")).toBe(true);
    expect(DateInterval.atMost(d(5)).toString().startsWith("(-Infinity,")).toBe(true);
  });

  test("withStart / withEnd return adjusted intervals", () => {
    expect(
      DateInterval.closed(d(1), d(10))
        .withStart(d(3), true)
        .equals(DateInterval.closed(d(3), d(10))),
    ).toBe(true);
    expect(
      DateInterval.closed(d(1), d(10))
        .withEnd(d(8), false)
        .equals(DateInterval.closedOpen(d(1), d(8))),
    ).toBe(true);
  });
});

describe("stringDomain (lexicographic, continuous)", () => {
  test("contains by code-unit order; encloses / overlaps", () => {
    const az = StringInterval.closedOpen("a", "n");
    expect(az.contains("mango")).toBe(true);
    expect(az.contains("apple")).toBe(true);
    expect(az.contains("n")).toBe(false); // open upper
    expect(az.contains("zebra")).toBe(false);
    expect(az.isDiscrete).toBe(false);
    expect(StringInterval.closed("a", "z").encloses(StringInterval.closed("f", "m"))).toBe(true);
  });

  test("prefix-style keyspace range + parse round-trip (comma-free)", () => {
    // Half-open [prefix, prefix + '￿') is the idiomatic prefix scan.
    const users = StringInterval.closedOpen("user:", "user:￿");
    expect(users.contains("user:42")).toBe(true);
    expect(users.contains("usen")).toBe(false);
    expect(StringInterval.parse("[apple,mango]").toString()).toBe("[apple,mango]");
    expect(stringDomain.name).toBe("string");
    expect(stringDomain.next).toBeUndefined(); // continuous
  });

  test("length is null (no natural string distance)", () => {
    expect(StringInterval.closed("a", "z").length()).toBeNull();
  });
});

describe("createOrdinalInterval (discrete, ordered labels)", () => {
  const Size = createOrdinalInterval(["XS", "S", "M", "L", "XL"]);

  test("ordering follows list position; length counts labels", () => {
    const r = Size.closed(Size.index("S"), Size.index("L"));
    expect(r.toString()).toBe("[S,L]");
    expect(r.length()).toBe(3); // {S, M, L}
    expect(r.contains(Size.index("M"))).toBe(true);
    expect(r.contains(Size.index("XL"))).toBe(false);
    expect(r.isDiscrete).toBe(true);
  });

  test("full range (closed at the last label) works — no successor overflow", () => {
    const all = Size.closed(Size.index("XS"), Size.index("XL"));
    expect(all.length()).toBe(5);
    expect(all.toString()).toBe("[XS,XL]");
  });

  test("adjacent label ranges merge; parse round-trips via labels", () => {
    expect(
      Size.closed(Size.index("XS"), Size.index("S"))
        .union(Size.closed(Size.index("M"), Size.index("L")))
        ?.toString(),
    ).toBe("[XS,L]");
    expect(Size.parse("[S,L]").toString()).toBe("[S,L]");
    expect(() => Size.parse("[S,XXL]")).toThrow(/invalid ordinal label/);
  });

  test("index / label helpers; middle is the median label", () => {
    expect(Size.index("M")).toBe(2);
    expect(Size.label(2)).toBe("M");
    expect(Size.labels).toEqual(["XS", "S", "M", "L", "XL"]);
    expect(Size.label(Size.closed(Size.index("XS"), Size.index("XL")).middle() ?? -1)).toBe("M");
  });
});
