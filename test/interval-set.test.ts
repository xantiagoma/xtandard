import { describe, expect, test } from "vitest";

import { Interval, type IntervalDomain } from "../src/interval";
import {
  BigIntInterval,
  createOrdinalInterval,
  DateInterval,
  IntegerInterval,
  NumberInterval,
  StringInterval,
} from "../src/interval-domains";
import { IntervalSet } from "../src/interval-set";

const N = (text: string) => NumberInterval.parse(text);
const NS = (...texts: string[]) => IntervalSet.of(NumberInterval.domain, texts.map(N));
const I = (a: number, b: number) => IntegerInterval.closed(a, b);
const IS = (...pairs: [number, number][]) =>
  IntervalSet.of(
    IntegerInterval.domain,
    pairs.map(([a, b]) => I(a, b)),
  );

describe("IntervalSet — construction & normalization", () => {
  test("of() sorts, coalesces overlapping and touching intervals, drops empties", () => {
    expect(NS("[5,6]", "[0,1)", "[1,2]", "(1.5,3)", "∅").toString()).toBe("[0,3) ∪ [5,6]");
    // continuous: (0,1) and (1,2) leave the point 1 out → stay apart
    expect(NS("(0,1)", "(1,2)").toString()).toBe("(0,1) ∪ (1,2)");
    // [0,1] and (1,2) touch with no gap → one interval
    expect(NS("[0,1]", "(1,2)").toString()).toBe("[0,2)");
  });

  test("discrete: epsilon-adjacent intervals merge (Guava TreeRangeSet)", () => {
    expect(IS([1, 3], [4, 6]).toString()).toBe("[1,6]");
    expect(IS([1, 3], [5, 6]).toString()).toBe("[1,3] ∪ [5,6]");
    expect(IntervalSet.of(IntegerInterval.domain, [IntegerInterval.open(0, 4)]).toString()).toBe(
      "[1,3]",
    );
  });

  test("empty / all / size / isEmpty / iteration / toArray", () => {
    const empty = IntervalSet.empty(NumberInterval.domain);
    expect(empty.isEmpty).toBe(true);
    expect(empty.size).toBe(0);
    expect(empty.toString()).toBe("∅");
    expect(IntervalSet.of(NumberInterval.domain).isEmpty).toBe(true);

    // number declares ±Infinity values → the whole line includes them
    expect(IntervalSet.all(NumberInterval.domain).toString()).toBe("[-Infinity,+Infinity]");
    expect(IntervalSet.all(IntegerInterval.domain).toString()).toBe("(-Infinity,+Infinity)");

    const set = NS("[0,1]", "[5,6]");
    expect(set.size).toBe(2);
    expect([...set].map(String)).toEqual(["[0,1]", "[5,6]"]);
    expect(set.toArray().map(String)).toEqual(["[0,1]", "[5,6]"]);
    expect(set.toArray()).not.toBe(set.toArray()); // fresh copies
    expect(set.toArray()[0]).toBeInstanceOf(Interval);
  });

  test("immutable: operations return new sets", () => {
    const set = NS("[0,1]");
    const added = set.add(N("[5,6]"));
    expect(set.toString()).toBe("[0,1]");
    expect(added.toString()).toBe("[0,1] ∪ [5,6]");
  });
});

describe("IntervalSet — queries", () => {
  const set = NS("[0,1]", "(2,3)", "[5,+Infinity)");

  test("contains / intervalContaining (binary search)", () => {
    expect(set.contains(0)).toBe(true);
    expect(set.contains(1)).toBe(true);
    expect(set.contains(1.5)).toBe(false);
    expect(set.contains(2)).toBe(false);
    expect(set.contains(2.5)).toBe(true);
    expect(set.contains(3)).toBe(false);
    expect(set.contains(1e9)).toBe(true);
    expect(set.contains(Infinity)).toBe(false); // open +∞
    expect(set.contains(-Infinity)).toBe(false);
    expect(set.contains(Number.NaN)).toBe(false);
    expect(set.intervalContaining(2.5)?.toString()).toBe("(2,3)");
    expect(set.intervalContaining(4)).toBeNull();
    expect(IntervalSet.empty(NumberInterval.domain).contains(0)).toBe(false);
  });

  test("encloses: one interval must cover — never across a gap", () => {
    expect(set.encloses(N("[0.2,0.8]"))).toBe(true);
    expect(set.encloses(N("[0,1]"))).toBe(true);
    expect(set.encloses(N("[0,3)"))).toBe(false); // spans the gap (1,2]
    expect(set.encloses(N("[2,3)"))).toBe(false); // 2 is excluded
    expect(set.encloses(N("[7,+Infinity)"))).toBe(true);
    expect(set.encloses(N("∅"))).toBe(true);
    expect(set.encloses(NS("[0,0.5]", "[6,7]"))).toBe(true);
    expect(set.encloses([N("[0,0.5]"), N("[4,7]")])).toBe(false);
  });

  test("intersects / isDisjointFrom", () => {
    expect(set.intersects(N("[1,2]"))).toBe(true); // shares 1
    expect(set.intersects(N("(1,2]"))).toBe(false);
    expect(set.intersects(N("[3,5)"))).toBe(false);
    expect(set.intersects(N("[3,5]"))).toBe(true);
    expect(set.intersects(N("∅"))).toBe(false);
    expect(set.isDisjointFrom(NS("(1,2]", "[3,5)"))).toBe(true);
    expect(set.intersects(NS("(1,2]", "[4,6]"))).toBe(true);
  });

  test("isSubsetOf / isSupersetOf", () => {
    expect(NS("[0,0.5]").isSubsetOf(set)).toBe(true);
    expect(set.isSupersetOf(N("[0,0.5]"))).toBe(true);
    expect(set.isSubsetOf(N("[0,+Infinity)"))).toBe(true);
    expect(set.isSubsetOf(N("[0,10]"))).toBe(false);
  });

  test("span / gaps / length", () => {
    expect(set.span().toString()).toBe("[0,+Infinity)");
    expect(set.gaps().toString()).toBe("(1,2] ∪ [3,5)");
    expect(set.length()).toBeNull(); // unbounded
    expect(NS("[0,1]", "[2,4)").length()).toBe(3);
    expect(IS([1, 3], [10, 12]).length()).toBe(6); // element count
    expect(IntervalSet.empty(NumberInterval.domain).span().isEmpty).toBe(true);
    expect(IntervalSet.empty(NumberInterval.domain).length()).toBe(0);
    expect(NS("[0,1]").gaps().isEmpty).toBe(true);
  });
});

describe("IntervalSet — set algebra", () => {
  test("union / intersection / difference / symmetricDifference", () => {
    const a = NS("[0,5]", "[10,15]");
    const b = NS("[3,12)");
    expect(a.union(b).toString()).toBe("[0,15]");
    expect(a.intersection(b).toString()).toBe("[3,5] ∪ [10,12)");
    expect(a.difference(b).toString()).toBe("[0,3) ∪ [12,15]");
    expect(b.difference(a).toString()).toBe("(5,10)");
    expect(a.symmetricDifference(b).toString()).toBe("[0,3) ∪ (5,10) ∪ [12,15]");
  });

  test("accept a set, a single interval, or a bag of intervals", () => {
    const a = NS("[0,10]");
    expect(a.difference(N("[2,3]")).toString()).toBe("[0,2) ∪ (3,10]");
    expect(a.difference([N("[2,3]"), N("[5,6]")]).toString()).toBe("[0,2) ∪ (3,5) ∪ (6,10]");
    expect(a.intersection(NS("[-1,1]", "[9,11]")).toString()).toBe("[0,1] ∪ [9,10]");
    expect(a.union([]).toString()).toBe("[0,10]");
  });

  test("add / remove", () => {
    expect(IS([1, 3]).add(I(4, 6)).toString()).toBe("[1,6]");
    expect(IS([1, 10]).remove(I(4, 6)).toString()).toBe("[1,3] ∪ [7,10]");
    expect(NS("[0,10]").remove(N("[0,10]")).isEmpty).toBe(true);
  });

  test("complement is domain-aware (unbounded ends, discrete steps, ±∞ points)", () => {
    expect(IS([1, 3], [7, 9]).complement().toString()).toBe(
      "(-Infinity,0] ∪ [4,6] ∪ [10,+Infinity)",
    );
    expect(NS("[0,1)").complement().toString()).toBe("[-Infinity,0) ∪ [1,+Infinity]");
    // the open -∞ bracket leaves the single point -∞ in the complement
    expect(NS("(-Infinity,0]").complement().toString()).toBe(
      "[-Infinity,-Infinity] ∪ (0,+Infinity]",
    );
    expect(NS("(-Infinity,0]").complement().contains(-Infinity)).toBe(true);
    expect(IntervalSet.empty(NumberInterval.domain).complement().toString()).toBe(
      "[-Infinity,+Infinity]",
    );
    expect(IntervalSet.all(NumberInterval.domain).complement().isEmpty).toBe(true);
  });

  test("complement is an involution", () => {
    for (const set of [
      NS("[0,1)", "(2,3]"),
      NS("(-Infinity,0]"),
      NS("[-Infinity,0]", "[5,+Infinity]"),
      IS([1, 3], [7, 9]),
    ]) {
      expect(set.complement().complement().equals(set)).toBe(true);
    }
  });

  test("difference keeps the ±∞ points exactly (cut-based)", () => {
    expect(NS("[-Infinity,5]").difference(N("(-Infinity,0]")).toString()).toBe(
      "[-Infinity,-Infinity] ∪ (0,5]",
    );
  });

  test("subSet clips to a window", () => {
    const set = NS("[0,2]", "[4,6]", "[8,10]");
    expect(set.subSet(N("[1,5)")).toString()).toBe("[1,2] ∪ [4,5)");
    expect(set.subSet(N("(2,4)")).isEmpty).toBe(true);
    expect(set.subSet(N("∅")).isEmpty).toBe(true);
    expect(set.subSet(N("(-Infinity,+Infinity)")).equals(set)).toBe(true);
  });
});

describe("IntervalSet — equality & string form", () => {
  test("equals compares values, not how bounds were written", () => {
    expect(NS("[0,1]", "[1,2]").equals(NS("[0,2]"))).toBe(true);
    expect(IS([1, 3], [4, 6]).equals(IS([1, 6]))).toBe(true);
    expect(NS("[0,1]").equals(NS("[0,1)"))).toBe(false);
    // `[0, Infinity]` as a finite endpoint is the same set as the closed unbounded side
    const finiteInf = IntervalSet.of(NumberInterval.domain, [NumberInterval.closed(0, Infinity)]);
    expect(finiteInf.equals(NS("[0,+Infinity]"))).toBe(true);
    // different domains never compare equal
    expect(
      IntervalSet.of(NumberInterval.domain, [NumberInterval.closed(1, 3)]).equals(
        IntervalSet.of(IntegerInterval.domain, [IntegerInterval.closed(1, 3)]),
      ),
    ).toBe(false);
  });

  test("parse ↔ format round trip", () => {
    for (const text of ["∅", "[0,1]", "[0,1) ∪ (2,3] ∪ [5,+Infinity)", "(-Infinity,0] ∪ [1,2]"]) {
      expect(IntervalSet.parse(NumberInterval.domain, text).toString()).toBe(text);
    }
    expect(IntervalSet.parse(NumberInterval.domain, "").isEmpty).toBe(true);
    // lenient: any order, overlaps, whitespace, infinity tokens
    expect(IntervalSet.parse(NumberInterval.domain, " [5,6]∪[0,2) ∪ [1,3] ").toString()).toBe(
      "[0,3] ∪ [5,6]",
    );
    expect(IntervalSet.parse(IntegerInterval.domain, "[1,3] ∪ [4,6]").toString()).toBe("[1,6]");
    expect(() => IntervalSet.parse(NumberInterval.domain, "[0,1] ∪ 3")).toThrow(/invalid interval/);
  });

  test("format passes ±∞ tokens to each interval", () => {
    expect(
      NS("(-Infinity,0]", "[1,+Infinity)").format({
        negativeInfinity: "-∞",
        positiveInfinity: "∞",
      }),
    ).toBe("(-∞,0] ∪ [1,∞)");
  });
});

// --- one test per zero-dep domain ----------------------------------------------

describe("IntervalSet — zero-dep domains", () => {
  test("integer", () => {
    const set = IS([1, 3], [4, 6], [10, 12]);
    expect(set.toString()).toBe("[1,6] ∪ [10,12]");
    expect(set.complement().subSet(I(0, 20)).toString()).toBe("[0,0] ∪ [7,9] ∪ [13,20]");
    expect(set.contains(2.5)).toBe(false); // fails isValid
  });

  test("bigint", () => {
    const set = IntervalSet.of(BigIntInterval.domain, [
      BigIntInterval.closed(1n, 5n),
      BigIntInterval.closed(6n, 9n),
      BigIntInterval.atLeast(2n ** 64n),
    ]);
    expect(set.toString()).toBe("[1,9] ∪ [18446744073709551616,+Infinity)");
    expect(set.contains(2n ** 70n)).toBe(true);
    expect(set.gaps().toString()).toBe("[10,18446744073709551615]");
  });

  test("Date", () => {
    const d = (iso: string) => new Date(iso);
    const set = IntervalSet.of(DateInterval.domain, [
      DateInterval.closedOpen(d("2026-01-01T09:00:00Z"), d("2026-01-01T10:00:00Z")),
      DateInterval.closedOpen(d("2026-01-01T10:00:00Z"), d("2026-01-01T11:00:00Z")),
      DateInterval.closedOpen(d("2026-01-01T13:00:00Z"), d("2026-01-01T14:00:00Z")),
    ]);
    expect(set.size).toBe(2);
    expect(set.length()).toBe(3 * 3_600_000);
    expect(set.contains(d("2026-01-01T10:59:59Z"))).toBe(true);
    expect(set.contains(d("invalid"))).toBe(false);
    expect(set.gaps().toString()).toBe("[2026-01-01T11:00:00.000Z,2026-01-01T13:00:00.000Z)");
    expect(IntervalSet.parse(DateInterval.domain, set.toString()).equals(set)).toBe(true);
  });

  test("string (lexicographic)", () => {
    const shards = IntervalSet.of(StringInterval.domain, [
      StringInterval.closedOpen("a", "h"),
      StringInterval.closedOpen("h", "n"),
      StringInterval.closedOpen("t", "z"),
    ]);
    expect(shards.toString()).toBe("[a,n) ∪ [t,z)");
    expect(shards.contains("mango")).toBe(true);
    expect(shards.contains("pear")).toBe(false);
    expect(shards.complement().toString()).toBe("(-Infinity,a) ∪ [n,t) ∪ [z,+Infinity)");
  });

  test("ordinal", () => {
    const Size = createOrdinalInterval(["XS", "S", "M", "L", "XL"]);
    const set = IntervalSet.of(Size.domain, [
      Size.point(Size.index("XS")),
      Size.point(Size.index("S")),
      Size.point(Size.index("L")),
    ]);
    expect(set.toString()).toBe("[XS,S] ∪ [L,L]");
    expect(set.gaps().toString()).toBe("[M,M]");
    expect(set.length()).toBe(3);
    expect(IntervalSet.parse(Size.domain, "[XS,S] ∪ [M,XL]").toString()).toBe("[XS,XL]");
  });
});

// --- model check: random sets vs. brute-force membership ----------------------

/** Deterministic PRNG (mulberry32) so failures reproduce. */
function rng(seed: number) {
  let a = seed;

  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomInterval(
  domain: IntervalDomain<number>,
  random: () => number,
  withInfinity: boolean,
): Interval<number> {
  const pick = () => Math.floor(random() * 11);
  const a = pick();
  const b = a + Math.floor(random() * 5);
  const unboundedLower = random() < 0.1;
  const unboundedUpper = random() < 0.1;
  const closedInf = () => withInfinity && random() < 0.5;

  return Interval.of(
    domain,
    unboundedLower
      ? { unbounded: true, closed: closedInf() }
      : { unbounded: false, value: a, closed: random() < 0.5 },
    unboundedUpper
      ? { unbounded: true, closed: closedInf() }
      : { unbounded: false, value: b, closed: random() < 0.5 },
  );
}

function checkNormalized<T>(set: IntervalSet<T>) {
  const parts = set.toArray();
  for (const part of parts) expect(part.isEmpty).toBe(false);
  for (let i = 1; i < parts.length; i++) {
    expect(parts[i - 1]!.isBefore(parts[i]!)).toBe(true);
    expect(parts[i - 1]!.isConnected(parts[i]!)).toBe(false);
  }
}

describe.each([
  { name: "number (continuous, extended line)", domain: NumberInterval.domain, inf: true },
  { name: "integer (discrete)", domain: IntegerInterval.domain, inf: false },
])("IntervalSet model check — $name", ({ domain, inf }) => {
  // Half-steps catch open/closed mistakes on the continuous line; ±∞ the extended ends.
  const probes = [-Infinity, -3, ...Array.from({ length: 34 }, (_, i) => i / 2 - 2), 30, Infinity];
  const random = rng(inf ? 42 : 7);
  const randomSet = () =>
    IntervalSet.of(
      domain,
      Array.from({ length: Math.floor(random() * 4) }, () => randomInterval(domain, random, inf)),
    );
  const member = (intervals: Interval<number>[], x: number) => intervals.some((i) => i.contains(x));
  const valid = (x: number) => domain.isValid?.(x) ?? true;

  test("of / union / intersection / difference / symmetricDifference / complement", () => {
    for (let round = 0; round < 400; round++) {
      const rawA = Array.from({ length: 1 + Math.floor(random() * 4) }, () =>
        randomInterval(domain, random, inf),
      );
      const a = IntervalSet.of(domain, rawA);
      const b = randomSet();
      const results = {
        union: a.union(b),
        intersection: a.intersection(b),
        difference: a.difference(b),
        symmetric: a.symmetricDifference(b),
        complement: a.complement(),
      };

      for (const set of Object.values(results)) checkNormalized(set);
      checkNormalized(a);

      for (const x of probes) {
        const inA = member(rawA, x);
        const inB = b.contains(x);
        expect(a.contains(x)).toBe(inA);
        expect(results.union.contains(x)).toBe(inA || inB);
        expect(results.intersection.contains(x)).toBe(inA && inB);
        expect(results.difference.contains(x)).toBe(inA && !inB);
        expect(results.symmetric.contains(x)).toBe(inA !== inB);
        expect(results.complement.contains(x)).toBe(valid(x) && !inA);
      }

      expect(results.complement.complement().equals(a)).toBe(true);
      expect(IntervalSet.parse(domain, a.toString()).equals(a)).toBe(true);
    }
  });

  test("encloses / intersects / subSet / gaps agree with membership", () => {
    for (let round = 0; round < 400; round++) {
      const a = randomSet();
      const window = randomInterval(domain, random, inf);
      const inWindow = probes.filter((x) => window.contains(x));
      const brute = inWindow.every((x) => a.contains(x));

      // encloses ⇒ every probe inside; a single containing interval must exist.
      if (a.encloses(window)) expect(brute).toBe(true);
      expect(a.encloses(window)).toBe(
        window.isEmpty || a.toArray().some((piece) => piece.encloses(window)),
      );
      expect(a.intersects(window)).toBe(!a.intersection(window).isEmpty);

      const sub = a.subSet(window);
      checkNormalized(sub);
      expect(sub.equals(a.intersection(window))).toBe(true);

      const gaps = a.gaps();
      checkNormalized(gaps);
      expect(gaps.equals(a.complement().intersection(a.span()))).toBe(true);
    }
  });
});

describe("IntervalSet — JSDoc examples", () => {
  test("class example (integers)", () => {
    const set = IntervalSet.of(IntegerInterval.domain, [
      IntegerInterval.closed(10, 12),
      IntegerInterval.closed(1, 3),
      IntegerInterval.closed(4, 6),
    ]);
    expect(set.toString()).toBe("[1,6] ∪ [10,12]");
    expect(set.contains(5)).toBe(true);
    expect(set.contains(8)).toBe(false);
    expect(set.gaps().toString()).toBe("[7,9]");
    expect(set.remove(IntegerInterval.closed(2, 4)).toString()).toBe("[1,1] ∪ [5,6] ∪ [10,12]");
    expect(set.complement().toString()).toBe("(-Infinity,0] ∪ [7,9] ∪ [13,+Infinity)");
  });

  test("class example (continuous)", () => {
    const set = IntervalSet.of(NumberInterval.domain, [
      NumberInterval.closedOpen(0, 1),
      NumberInterval.closed(1, 2),
      NumberInterval.open(5, 6),
    ]);
    expect(set.toString()).toBe("[0,2] ∪ (5,6)");
    expect(set.difference(NumberInterval.closed(1, 5.5)).toString()).toBe("[0,1) ∪ (5.5,6)");
    expect(set.length()).toBe(3);
  });
});
