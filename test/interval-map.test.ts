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
import { IntervalMap } from "../src/interval-map";
import { IntervalSet } from "../src/interval-set";

const N = (text: string) => NumberInterval.parse(text);
const I = (a: number, b: number) => IntegerInterval.closed(a, b);

describe("IntervalMap — put / get", () => {
  const tax = IntervalMap.of(NumberInterval.domain, [
    [NumberInterval.closedOpen(0, 10_000), 0],
    [NumberInterval.closedOpen(10_000, 40_000), 0.1],
    [NumberInterval.atLeast(40_000), 0.2],
  ]);

  test("get / getEntry / has (binary search)", () => {
    expect(tax.get(0)).toBe(0);
    expect(tax.get(9_999.99)).toBe(0);
    expect(tax.get(10_000)).toBe(0.1);
    expect(tax.get(25_000)).toBe(0.1);
    expect(tax.get(1e12)).toBe(0.2);
    expect(tax.get(-5)).toBeUndefined();
    expect(tax.get(Number.NaN)).toBeUndefined();
    expect(tax.has(-5)).toBe(false);
    expect(tax.has(0)).toBe(true);
    const entry = tax.getEntry(25_000);
    expect(entry?.[0].toString()).toBe("[10000,40000)");
    expect(entry?.[1]).toBe(0.1);
    expect(tax.size).toBe(3);
  });

  test("put overwrites the overlapped part and splits what it cuts through", () => {
    const promo = tax.put(NumberInterval.closedOpen(5_000, 15_000), 0.05);
    expect(promo.toString()).toBe(
      "{[0,5000) => 0, [5000,15000) => 0.05, [15000,40000) => 0.1, [40000,+Infinity) => 0.2}",
    );
    expect(promo.getEntry(12_000)?.[0].toString()).toBe("[5000,15000)");
    // the original is untouched (immutable)
    expect(tax.size).toBe(3);
  });

  test("put inside one entry splits it into three", () => {
    const m = IntervalMap.of(NumberInterval.domain, [[N("[0,10]"), "a"]]).put(N("(3,4)"), "b");
    expect(m.toString()).toBe("{[0,3] => a, (3,4) => b, [4,10] => a}");
  });

  test("put does NOT merge touching entries with equal values (Guava)", () => {
    const m = IntervalMap.of(IntegerInterval.domain, [
      [I(1, 3), "x"],
      [I(4, 6), "x"],
    ]);
    expect(m.toString()).toBe("{[1,3] => x, [4,6] => x}");
  });

  test("later entries win where they overlap; empty intervals are ignored", () => {
    const m = IntervalMap.of(NumberInterval.domain, [
      [N("[0,10]"), "a"],
      [N("[5,15]"), "b"],
      [N("∅"), "c"],
    ]);
    expect(m.toString()).toBe("{[0,5) => a, [5,15] => b}");
  });

  test("V can be undefined: has() tells mapped-to-undefined from unmapped", () => {
    const m = IntervalMap.of<number, string | undefined>(NumberInterval.domain, [
      [N("[0,1]"), undefined],
    ]);
    expect(m.get(0.5)).toBeUndefined();
    expect(m.has(0.5)).toBe(true);
    expect(m.has(2)).toBe(false);
  });
});

describe("IntervalMap — putCoalescing", () => {
  test("merges connected neighbours with an equal value", () => {
    const shifts = IntervalMap.empty<number, string>(IntegerInterval.domain)
      .putCoalescing(I(1, 5), "ana")
      .putCoalescing(I(6, 9), "ana") // adjacent on the integers
      .putCoalescing(I(10, 12), "bo");
    expect(shifts.toString()).toBe("{[1,9] => ana, [10,12] => bo}");
    expect(shifts.remove(I(4, 6)).toString()).toBe("{[1,3] => ana, [7,9] => ana, [10,12] => bo}");
  });

  test("bridges two equal neighbours; overwrites different values in between", () => {
    const m = IntervalMap.of(NumberInterval.domain, [
      [N("[0,2)"), "a"],
      [N("[2,3)"), "b"],
      [N("[3,5)"), "a"],
    ]).putCoalescing(N("[1,4]"), "a");
    expect(m.toString()).toBe("{[0,5) => a}");
  });

  test("a different value does not coalesce", () => {
    const m = IntervalMap.of(NumberInterval.domain, [[N("[0,2)"), "a"]]).putCoalescing(
      N("[2,3)"),
      "b",
    );
    expect(m.toString()).toBe("{[0,2) => a, [2,3) => b}");
  });

  test("inside an entry with the same value is a no-op; with another value it splits", () => {
    const base = IntervalMap.of(NumberInterval.domain, [[N("[0,10]"), "a"]]);
    expect(base.putCoalescing(N("[2,3]"), "a").equals(base)).toBe(true);
    expect(base.putCoalescing(N("[2,3]"), "b").toString()).toBe(
      "{[0,2) => a, [2,3] => b, (3,10] => a}",
    );
  });

  test("continuous: only touching (no gap) neighbours coalesce", () => {
    const m = IntervalMap.empty<number, string>(NumberInterval.domain)
      .putCoalescing(N("[0,1)"), "a")
      .putCoalescing(N("(1,2]"), "a"); // the point 1 is still a gap
    expect(m.size).toBe(2);
    expect(m.putCoalescing(N("[1,1]"), "a").toString()).toBe("{[0,2] => a}");
  });

  test("valueEquals option: structural equality for object values", () => {
    type Rate = { amount: number; currency: string };
    const options = {
      valueEquals: (a: Rate, b: Rate) => a.amount === b.amount && a.currency === b.currency,
    };
    const m = IntervalMap.empty<number, Rate>(IntegerInterval.domain, options)
      .putCoalescing(I(1, 5), { amount: 100, currency: "USD" })
      .putCoalescing(I(6, 9), { amount: 100, currency: "USD" }); // a new, equal object
    expect(m.size).toBe(1);
    expect(m.valueEquals).toBe(options.valueEquals);
    // derived maps keep the option
    expect(m.put(I(20, 21), { amount: 1, currency: "USD" }).valueEquals).toBe(options.valueEquals);

    // the default (Object.is) does not merge distinct objects
    const byIdentity = IntervalMap.empty<number, Rate>(IntegerInterval.domain)
      .putCoalescing(I(1, 5), { amount: 100, currency: "USD" })
      .putCoalescing(I(6, 9), { amount: 100, currency: "USD" });
    expect(byIdentity.size).toBe(2);
  });
});

describe("IntervalMap — remove / subMap / span / iteration / equality", () => {
  const m = IntervalMap.of(NumberInterval.domain, [
    [N("[0,2]"), "a"],
    [N("(2,4)"), "b"],
    [N("[6,8]"), "c"],
  ]);

  test("remove splits straddling entries; no-overlap returns the same map", () => {
    expect(m.remove(N("[1,3]")).toString()).toBe("{[0,1) => a, (3,4) => b, [6,8] => c}");
    expect(m.remove(N("[4,6)"))).toBe(m);
    expect(m.remove(N("∅"))).toBe(m);
    expect(m.remove(N("(-Infinity,+Infinity)")).isEmpty).toBe(true);
  });

  test("subMap clips entries to a window", () => {
    expect(m.subMap(N("[1,7)")).toString()).toBe("{[1,2] => a, (2,4) => b, [6,7) => c}");
    expect(m.subMap(N("[4,6)")).isEmpty).toBe(true);
    expect(m.subMap(N("∅")).isEmpty).toBe(true);
  });

  test("span / toIntervalSet", () => {
    expect(m.span().toString()).toBe("[0,8]");
    expect(m.toIntervalSet().toString()).toBe("[0,4) ∪ [6,8]");
    expect(m.toIntervalSet()).toBeInstanceOf(IntervalSet);
    expect(IntervalMap.empty(NumberInterval.domain).span().isEmpty).toBe(true);
  });

  test("entries / keys / values / iteration / toArray", () => {
    expect([...m].map(([k, v]) => `${k}=${v}`)).toEqual(["[0,2]=a", "(2,4)=b", "[6,8]=c"]);
    expect([...m.entries()].length).toBe(3);
    expect([...m.keys()].map(String)).toEqual(["[0,2]", "(2,4)", "[6,8]"]);
    expect([...m.values()]).toEqual(["a", "b", "c"]);
    expect(m.toArray()).toHaveLength(3);
    expect(new Map(m).get(m.toArray()[1]![0])).toBe("b");
  });

  test("equals / format", () => {
    const same = IntervalMap.of(NumberInterval.domain, [
      [N("[6,8]"), "c"],
      [N("(2,4)"), "b"],
      [N("[0,2]"), "a"],
    ]);
    expect(m.equals(same)).toBe(true);
    expect(m.equals(same.put(N("[0,1]"), "z"))).toBe(false);
    expect(IntervalMap.empty(NumberInterval.domain).toString()).toBe("{}");
    expect(
      IntervalMap.of(NumberInterval.domain, [[N("[0,+Infinity)"), { rate: 3 }]]).format({
        positiveInfinity: "∞",
        formatValue: (v) => JSON.stringify(v),
      }),
    ).toBe('{[0,∞) => {"rate":3}}');
  });
});

describe("IntervalMap — zero-dep domains", () => {
  test("integer / bigint", () => {
    expect(
      IntervalMap.of(IntegerInterval.domain, [
        [I(1, 10), "a"],
        [I(4, 6), "b"],
      ]).toString(),
    ).toBe("{[1,3] => a, [4,6] => b, [7,10] => a}");

    const m = IntervalMap.of(BigIntInterval.domain, [
      [BigIntInterval.closed(0n, 2n ** 64n), "u64"],
      [BigIntInterval.closed(10n, 20n), "small"],
    ]);
    expect(m.get(15n)).toBe("small");
    expect(m.get(2n ** 63n)).toBe("u64");
    expect(m.toString()).toBe("{[0,9] => u64, [10,20] => small, [21,18446744073709551616] => u64}");
  });

  test("Date", () => {
    const d = (iso: string) => new Date(iso);
    const prices = IntervalMap.of(DateInterval.domain, [
      [DateInterval.atLeast(d("2026-01-01T00:00:00Z")), 100],
      [DateInterval.atLeast(d("2026-07-01T00:00:00Z")), 120],
    ]);
    expect(prices.get(d("2026-03-01T00:00:00Z"))).toBe(100);
    expect(prices.get(d("2026-08-01T00:00:00Z"))).toBe(120);
    expect(prices.get(d("2025-12-31T23:59:59Z"))).toBeUndefined();
  });

  test("string / ordinal", () => {
    const owners = IntervalMap.of(StringInterval.domain, [
      [StringInterval.closedOpen("a", "n"), "shard-1"],
      [StringInterval.atLeast("n"), "shard-2"],
    ]);
    expect(owners.get("mango")).toBe("shard-1");
    expect(owners.get("pear")).toBe("shard-2");

    const Size = createOrdinalInterval(["XS", "S", "M", "L", "XL"]);
    const shipping = IntervalMap.of(Size.domain, [
      [Size.closed(Size.index("XS"), Size.index("M")), "letter"],
      [Size.atLeast(Size.index("L")), "parcel"],
    ]);
    expect(shipping.get(Size.index("S"))).toBe("letter");
    expect(shipping.toString()).toBe("{[XS,M] => letter, [L,+Infinity) => parcel}");
  });
});

// --- model check: random put/putCoalescing/remove vs. a point-by-point model ---

function rng(seed: number) {
  let a = seed;

  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomInterval(domain: IntervalDomain<number>, random: () => number): Interval<number> {
  const a = Math.floor(random() * 11);
  const b = a + Math.floor(random() * 5);

  return Interval.of(
    domain,
    random() < 0.1
      ? { unbounded: true, closed: false }
      : { unbounded: false, value: a, closed: random() < 0.5 },
    random() < 0.1
      ? { unbounded: true, closed: false }
      : { unbounded: false, value: b, closed: random() < 0.5 },
  );
}

describe.each([
  { name: "number", domain: NumberInterval.domain },
  { name: "integer", domain: IntegerInterval.domain },
])("IntervalMap model check — $name", ({ domain }) => {
  const probes = [-3, ...Array.from({ length: 34 }, (_, i) => i / 2 - 2), 30];

  test("put / putCoalescing / remove agree with last-write-wins per point", () => {
    const random = rng(domain === NumberInterval.domain ? 1 : 2);

    for (let round = 0; round < 200; round++) {
      let map = IntervalMap.empty<number, number>(domain);
      const model = new Map<number, number>();

      for (let step = 0; step < 8; step++) {
        const interval = randomInterval(domain, random);
        const op = random();
        const value = Math.floor(random() * 3);

        if (op < 0.4) map = map.put(interval, value);
        else if (op < 0.8) map = map.putCoalescing(interval, value);
        else map = map.remove(interval);

        for (const x of probes) {
          if (!interval.contains(x)) continue;
          if (op < 0.8) model.set(x, value);
          else model.delete(x);
        }

        // invariants: sorted, disjoint, non-empty
        const entries = map.toArray();
        for (const [key] of entries) expect(key.isEmpty).toBe(false);
        for (let i = 1; i < entries.length; i++) {
          expect(entries[i - 1]![0].isBefore(entries[i]![0])).toBe(true);
        }

        const wrong = probes.filter((x) => map.get(x) !== model.get(x));
        expect(wrong).toEqual([]);
      }

      // a map built only by putCoalescing has no connected neighbours with equal values
      let coalesced = IntervalMap.empty<number, number>(domain);
      for (let step = 0; step < 8; step++) {
        coalesced = coalesced.putCoalescing(
          randomInterval(domain, random),
          Math.floor(random() * 2),
        );
      }
      const entries = coalesced.toArray();
      for (let i = 1; i < entries.length; i++) {
        const [prevKey, prevValue] = entries[i - 1]!;
        const [key, value] = entries[i]!;
        expect(prevKey.isConnected(key) && prevValue === value).toBe(false);
      }

      const window = randomInterval(domain, random);
      const sub = map.subMap(window);
      const wrongSub = probes.filter(
        (x) => sub.get(x) !== (window.contains(x) ? map.get(x) : undefined),
      );
      expect(wrongSub).toEqual([]);
    }
  }, 30_000); // model checks: headroom when the whole suite runs in parallel
});
