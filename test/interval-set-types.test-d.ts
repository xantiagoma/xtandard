/**
 * Compile-time inference assertions for `IntervalSet` / `IntervalMap`.
 * Statically checked by `tsc --noEmit` (via `bun run check`); not run by the
 * test runner. See CLAUDE.md → Testing for the `*.test-d.ts` convention.
 */
import type { Temporal } from "@js-temporal/polyfill";
import type { Equal, Expect } from "type-testing";

type Element<I> = I extends Iterable<infer E> ? E : never;

import type { Interval } from "../src/interval.ts";
import { DateInterval, NumberInterval, StringInterval } from "../src/interval-domains.ts";
import { IntervalMap, type IntervalMapEntry } from "../src/interval-map.ts";
import { IntervalSet } from "../src/interval-set.ts";
import { InstantInterval } from "../src/interval-temporal.ts";

// --- IntervalSet infers T from the domain ------------------------------------

const numbers = IntervalSet.of(NumberInterval.domain, [NumberInterval.closed(1, 2)]);
export type _SetOf = Expect<Equal<typeof numbers, IntervalSet<number>>>;
export type _SetEmpty = Expect<
  Equal<ReturnType<typeof IntervalSet.empty<Date>>, IntervalSet<Date>>
>;
const instants = IntervalSet.of(InstantInterval.domain);
export type _SetTemporal = Expect<Equal<typeof instants, IntervalSet<Temporal.Instant>>>;

// operations keep T; lookups return the element / interval types
export type _SetUnion = Expect<Equal<ReturnType<typeof numbers.union>, IntervalSet<number>>>;
export type _SetComplement = Expect<
  Equal<ReturnType<typeof numbers.complement>, IntervalSet<number>>
>;
export type _SetContaining = Expect<
  Equal<ReturnType<typeof numbers.intervalContaining>, Interval<number> | null>
>;
export type _SetSpan = Expect<Equal<ReturnType<typeof numbers.span>, Interval<number>>>;
export type _SetIterate = Expect<Equal<Element<typeof numbers>, Interval<number>>>;
export type _SetLength = Expect<Equal<ReturnType<typeof numbers.length>, number | null>>;

// a set of one element type rejects intervals of another
// @ts-expect-error — Interval<string> is not Interval<number>
numbers.add(StringInterval.closed("a", "b"));
// @ts-expect-error — the domain fixes T
IntervalSet.of(NumberInterval.domain, [DateInterval.closed(new Date(), new Date())]);

// --- IntervalMap infers T from the domain and V from the entries -------------

const rates = IntervalMap.of(NumberInterval.domain, [
  [NumberInterval.closedOpen(0, 10), "low"],
  [NumberInterval.atLeast(10), "high"],
]);
export type _MapOf = Expect<Equal<typeof rates, IntervalMap<number, string>>>;
export type _MapGet = Expect<Equal<ReturnType<typeof rates.get>, string | undefined>>;
export type _MapEntry = Expect<
  Equal<ReturnType<typeof rates.getEntry>, IntervalMapEntry<number, string> | undefined>
>;
export type _MapEntryShape = Expect<
  Equal<IntervalMapEntry<number, string>, readonly [interval: Interval<number>, value: string]>
>;
export type _MapIterate = Expect<Equal<Element<typeof rates>, IntervalMapEntry<number, string>>>;
export type _MapValues = Expect<Equal<Element<ReturnType<typeof rates.values>>, string>>;
export type _MapToSet = Expect<Equal<ReturnType<typeof rates.toIntervalSet>, IntervalSet<number>>>;

const empty = IntervalMap.empty<number, { rate: number }>(NumberInterval.domain, {
  valueEquals: (a, b) => a.rate === b.rate, // a and b are contextually typed
});
export type _MapEmpty = Expect<Equal<typeof empty, IntervalMap<number, { rate: number }>>>;

// @ts-expect-error — the value type is fixed by the map
rates.put(NumberInterval.closed(1, 2), 42);
