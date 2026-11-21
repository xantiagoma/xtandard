---
title: "Availability with intervals"
description: "Model meeting-room bookings with Interval<T>, IntervalSet and IntervalMap: detect conflicts, merge busy time, find free slots that fit, price time by period, and classify room rates into money price bands."
---

In this tutorial you model a meeting room's day with `Interval<T>`: you store bookings as time ranges,
detect conflicts, merge the busy time into an `IntervalSet`, find free slots long enough for a new
meeting, price a booking with an `IntervalMap` of hourly rates, and sort room rates into price bands
with money intervals. Each step adds a small function. At the end they make up one availability
module.

Intervals fit this problem well. A booking is a range of time, "is the room free?" asks whether two
ranges overlap, and "when is it free?" is the opening hours minus the busy ranges. Writing these
comparisons by hand is where off-by-one bugs at the boundaries come from.

```sh
npm install @xtandard/lib @js-temporal/polyfill dinero.js
```

```ts
import { IntervalMap, IntervalSet, type Interval } from "@xtandard/lib/interval";
import { InstantInterval } from "@xtandard/lib/temporal";
import { createDineroInterval } from "@xtandard/lib/dinero";
```

`@xtandard/lib/interval` is the zero-dependency engine, with the `IntervalSet` and `IntervalMap`
collections. `@xtandard/lib/temporal` adds intervals over the
TC39 `Temporal` types (peer `@js-temporal/polyfill`), and `@xtandard/lib/dinero` adds money intervals
(peer `dinero.js` v2).

## 1. Represent a booking

A booking is a range of instants. Use **half-open** ranges, `[start, end)`: the start is included, the
end is not. A meeting from 10:30 to 11:00 then ends exactly where the next one can begin, and the two do
not overlap.

```ts title="availability.ts"
import { Temporal } from "@js-temporal/polyfill";
import { IntervalMap, IntervalSet, type Interval } from "@xtandard/lib/interval";
import { InstantInterval } from "@xtandard/lib/temporal";

type Slot = Interval<Temporal.Instant>;
type Booking = { id: string; room: string; when: Slot };

// helpers for the examples: times on 2 March 2026, in UTC
const at = (time: string) => Temporal.Instant.from(`2026-03-02T${time}:00Z`);
const slot = (from: string, to: string): Slot => InstantInterval.closedOpen(at(from), at(to));

const bookings: Booking[] = [
  { id: "b1", room: "atlas", when: slot("09:30", "10:30") },
  { id: "b2", room: "atlas", when: slot("10:30", "11:00") },
  { id: "b3", room: "atlas", when: slot("13:00", "14:30") },
  { id: "b4", room: "atlas", when: slot("14:00", "15:00") }, // double-booked with b3
];

const openingHours = slot("09:00", "18:00");
```

`InstantInterval` is a class bound to the `Temporal.Instant` domain. Its static factories (`closed`,
`open`, `closedOpen`, `atLeast`, …) build intervals, and every operation returns a new interval: nothing
changes in place.

:::tip
No Temporal in your stack? `DateInterval` from `@xtandard/lib/interval` has the same API over `Date`,
with no dependencies. Use `Temporal.Instant` when you need exact ordering below a millisecond or want
the ISO string form.
:::

## 2. Detect conflicts

`overlaps` is true when two intervals share at least one instant. Because the bookings are half-open,
back-to-back meetings do not conflict. `isAdjacent` tells you they touch.

```ts
const [b1, b2, b3, b4] = bookings.map((b) => b.when);

b1.overlaps(b2); // false: b1 ends at 10:30, exactly when b2 starts
b1.isAdjacent(b2); // true
b3.overlaps(b4); // true
b3.intersection(b4).toString(); // "[2026-03-02T14:00:00Z,2026-03-02T14:30:00Z)": the clash
```

`intersection` returns the shared part, or the empty interval `∅` when there is none, which makes a
good error message ("already booked from 14:00 to 14:30"). Wrap the check in a function:

```ts title="availability.ts"
export function conflicts(request: Slot, existing: Booking[]): Booking[] {
  return existing.filter((b) => b.when.overlaps(request));
}

conflicts(slot("10:00", "10:45"), bookings).map((b) => b.id); // ["b1", "b2"]
conflicts(slot("11:00", "12:00"), bookings).map((b) => b.id); // []
```

To check that a request fits inside opening hours, use `encloses`:

```ts
openingHours.encloses(slot("17:30", "18:00")); // true
openingHours.encloses(slot("17:30", "18:30")); // false
```

## 3. Merge the busy time

To answer "when is the room busy?", you want the smallest set of non-overlapping blocks. An
[`IntervalSet`](@BASE@/api/interval/classes/intervalset/) is exactly that: give
`IntervalSet.of` the domain and any bag of intervals,
and it sorts them and joins every pair that overlaps **or touches**, so b1 and b2 become one block,
and b3 and b4 another.

```ts title="availability.ts"
export type Busy = IntervalSet<Temporal.Instant>;

export function busyTime(existing: Booking[]): Busy {
  return IntervalSet.of(
    InstantInterval.domain,
    existing.map((b) => b.when),
  );
}

const busy = busyTime(bookings);
busy.toString();
// "[2026-03-02T09:30:00Z,2026-03-02T11:00:00Z) ∪ [2026-03-02T13:00:00Z,2026-03-02T15:00:00Z)"
busy.size; // 2 blocks
busy.length()! / 60_000; // 210 busy minutes
```

Each interval class exposes its domain as a static property (`InstantInterval.domain`). The set is
immutable, like an interval, and answers questions about the whole day in one call:

```ts
busy.contains(at("10:45")); // true: the room is in use at 10:45
busy.intersects(slot("11:00", "12:00")); // false: that hour is free
busy.intersects(slot("10:00", "10:45")); // true
```

`intersects` tells you _whether_ a request clashes. `conflicts` from step 2 still tells you _which_
bookings it clashes with.

:::tip
Need only the merged blocks as an array? `mergeIntervals(InstantInterval.domain, intervals)` does the
same coalescing without building a set.
:::

## 4. Find the free slots

Free time is the opening hours minus the busy time. Put the opening hours in a set and take the
`difference`:

```ts title="availability.ts"
export function freeSlots(window: Slot, busy: Busy): Busy {
  return IntervalSet.of(InstantInterval.domain, [window]).difference(busy);
}

const free = freeSlots(openingHours, busy);
free.toString();
// "[2026-03-02T09:00:00Z,2026-03-02T09:30:00Z) ∪ [2026-03-02T11:00:00Z,2026-03-02T13:00:00Z)
//  ∪ [2026-03-02T15:00:00Z,2026-03-02T18:00:00Z)"
```

`difference` keeps the open and closed ends exactly. Removing `[09:30, 11:00)` leaves `[09:00, 09:30)`,
which ends right where the busy block starts, and `[11:00, …)`, which starts right where it ends. Nothing
is lost or counted twice at the boundaries. `busy.complement().subSet(openingHours)` gives the same
set: everything that is not busy, clipped to the window.

For just the holes between busy blocks, use `gaps`:

```ts
busy.gaps().toString(); // "[2026-03-02T11:00:00Z,2026-03-02T13:00:00Z)"
```

A request can be booked when it fits inside **one** free slot. That is `encloses`, which checks
opening hours and conflicts in one go:

```ts title="availability.ts"
export function canBook(request: Slot, free: Busy): boolean {
  return free.encloses(request);
}

canBook(slot("11:30", "12:30"), free); // true
canBook(slot("10:45", "11:30"), free); // false: overlaps b2
canBook(slot("17:30", "18:30"), free); // false: past closing time
```

## 5. Fit a meeting into a free slot

`length()` measures an interval. For Temporal instants it returns **milliseconds** (or `null` if the
interval is unbounded). `fromStart(start, length)` builds the half-open interval `[start, start + length)`.
A set iterates its intervals in order, so a first-fit search is a `find`:

```ts title="availability.ts"
const minutes = (n: number) => n * 60_000;

export function firstFit(free: Busy, duration: number): Slot | null {
  const fit = free.toArray().find((piece) => (piece.length() ?? 0) >= duration);
  return fit ? InstantInterval.fromStart(fit.lowerValue()!, duration) : null;
}

free.toArray().map((piece) => piece.length()! / 60_000); // [30, 120, 180]
firstFit(free, minutes(90))?.toString(); // "[2026-03-02T11:00:00Z,2026-03-02T12:30:00Z)"
firstFit(free, minutes(240)); // null: no free stretch of 4 hours
```

`lowerValue()` returns the start of the interval, or `null` when it has no lower bound. Every free slot
here comes from the bounded opening hours, so the `!` is safe.

:::note
Comparisons and `contains` on Temporal values are exact to the nanosecond. Only `length()`, `middle()`
and `fromStart` work in milliseconds, which is more than enough for calendars. See
[Temporal intervals](@BASE@/interval/domains/#temporal-intervals).
:::

## 6. Summarize the day

`span` returns the smallest interval that covers the whole set, across its gaps: the part of the day
the room is in use, from the first meeting to the last.

```ts
const inUse = busy.span();
inUse.toString(); // "[2026-03-02T09:30:00Z,2026-03-02T15:00:00Z)"
inUse.length()! / 60_000; // 330 minutes
inUse.middle()?.toString(); // "2026-03-02T12:15:00Z"
```

Compare it with `busy.length()`, the 210 minutes the room is actually booked.

## 7. Store intervals as text

`toString()` writes the standard interval notation, and `parse` reads it back. A set joins its
intervals with `∪`. That makes the busy time easy to keep in a text column, a JSON payload or a URL
parameter:

```ts
const stored = busy.toString();
// "[2026-03-02T09:30:00Z,2026-03-02T11:00:00Z) ∪ [2026-03-02T13:00:00Z,2026-03-02T15:00:00Z)"
IntervalSet.parse(InstantInterval.domain, stored).equals(busy); // true
InstantInterval.parse("[2026-03-02T09:30:00Z,2026-03-02T11:00:00Z)"); // a single interval
```

`parse` throws on input that does not parse (an invalid instant, for example), so validate stored or
user-supplied text at the boundary.

## 8. Rates per period

The room costs $50 an hour, except over lunch, when it costs $80. An
[`IntervalMap`](@BASE@/api/interval/classes/intervalmap/) maps each period to its rate. `put`
overwrites the part of the map it covers, so you write the base rate first and the exception on top:

```ts title="availability.ts"
const hourly = IntervalMap.of(InstantInterval.domain, [
  [openingHours, 50],
  [slot("12:00", "14:00"), 80], // splits the base rate in two
]);
hourly.toString();
// "{[2026-03-02T09:00:00Z,2026-03-02T12:00:00Z) => 50,
//   [2026-03-02T12:00:00Z,2026-03-02T14:00:00Z) => 80,
//   [2026-03-02T14:00:00Z,2026-03-02T18:00:00Z) => 50}"
hourly.get(at("12:30")); // 80
hourly.get(at("08:00")); // undefined: before opening
```

To price a booking, clip the map to the request with `subMap` and add up each piece:

```ts title="availability.ts"
const HOUR = 60 * 60_000;

export function price(request: Slot): number {
  let total = 0;
  for (const [piece, rate] of hourly.subMap(request)) total += (piece.length()! / HOUR) * rate;
  return total;
}

price(slot("11:00", "13:00")); // 130: one hour at $50, one at $80
price(slot("15:00", "15:30")); // 25
```

`put` keeps entries apart even when they touch and hold the same value. `putCoalescing` merges them,
which keeps the map minimal when you set a period back to a rate its neighbours already have:

```ts
hourly.put(slot("16:00", "18:00"), 50).size; // 4
hourly.putCoalescing(slot("16:00", "18:00"), 50).size; // 3
```

## 9. Price bands with money intervals

Rooms also have hourly rates, and the booking page groups them into bands. Money is **discrete**: the
smallest step is one minor unit (one cent for USD). Because a `Dinero` value carries its currency, you
create one interval class per currency with
[`createDineroInterval`](@BASE@/api/dinero/functions/createdinerointerval/). A band table is an
`IntervalMap` from price ranges to band names:

```ts title="pricing.ts"
import { createDineroInterval } from "@xtandard/lib/dinero";
import { IntervalMap, IntervalSet } from "@xtandard/lib/interval";
import { dinero, USD } from "dinero.js";

const UsdInterval = createDineroInterval(USD);
const usd = (cents: number) => dinero({ amount: cents, currency: USD });
type Usd = ReturnType<typeof usd>;

const bands = IntervalMap.of(UsdInterval.domain, [
  [UsdInterval.closedOpen(usd(0), usd(100_00)), "budget"], // $0 – $99.99
  [UsdInterval.closedOpen(usd(100_00), usd(250_00)), "standard"], // $100 – $249.99
  [UsdInterval.atLeast(usd(250_00)), "premium"], // $250 and up
]);

export const bandOf = (rate: Usd) => bands.get(rate);

bandOf(usd(99_99)); // "budget"
bandOf(usd(100_00)); // "standard"
bandOf(usd(1_000_00)); // "premium"
```

Because the domain is discrete, `[0, 10000)` and `[0, 9999]` (in cents) are the same set, and the
intervals print in their closed form:

```ts
bands.toString();
// "{[0,9999] => budget, [10000,24999] => standard, [25000,+Infinity) => premium}"
const [budgetBand] = bands.keys();
budgetBand.equals(UsdInterval.closed(usd(0), usd(99_99))); // true
budgetBand.length(); // 10000: the number of distinct amounts in the band
```

`toIntervalSet` checks that the band table has no holes. Discrete ranges that end and start one cent
apart are adjacent, so they coalesce, and `gaps` lists whatever is left uncovered:

```ts
bands.toIntervalSet().toString(); // "[0,+Infinity)": every rate from $0 up has a band

const typo = IntervalSet.of(UsdInterval.domain, [
  UsdInterval.closed(usd(0), usd(99_99)),
  UsdInterval.closed(usd(100_00), usd(249_99)),
  UsdInterval.closed(usd(250_01), usd(500_00)), // should start at 250_00
]);
typo.toString(); // "[0,24999] ∪ [25001,50000]"
typo.gaps().toString(); // "[25000,25000]": $250.00 has no band
```

A guest's budget is an interval too. `contains` filters rooms by rate, and `subMap` tells you which
bands to show:

```ts
const budget = UsdInterval.closed(usd(80_00), usd(150_00));

const rooms = [
  { name: "atlas", rate: usd(120_00) },
  { name: "borealis", rate: usd(75_00) },
  { name: "cosmos", rate: usd(300_00) },
];
rooms.filter((r) => budget.contains(r.rate)).map((r) => r.name); // ["atlas"]
[...bands.subMap(budget).values()]; // ["budget", "standard"]
```

The string form of a money interval is in **minor units**, so `UsdInterval.parse("[10000,25000)")` is
$100.00 up to (not including) $250.00. Keep amounts in whole minor units: a value with more precision
than a cent is ordered exactly, but it is rounded to the cent for `length()` and the string form.

## The complete module

```ts title="availability.ts"
import { Temporal } from "@js-temporal/polyfill";
import { IntervalMap, IntervalSet, type Interval } from "@xtandard/lib/interval";
import { InstantInterval } from "@xtandard/lib/temporal";

export type Slot = Interval<Temporal.Instant>;
export type Busy = IntervalSet<Temporal.Instant>;
export type Booking = { id: string; room: string; when: Slot };

export const minutes = (n: number) => n * 60_000;
const HOUR = minutes(60);

/** Bookings that share at least one instant with the request. */
export function conflicts(request: Slot, existing: Booking[]): Booking[] {
  return existing.filter((b) => b.when.overlaps(request));
}

/** Busy time as a set of disjoint blocks (overlapping and back-to-back bookings merged). */
export function busyTime(existing: Booking[]): Busy {
  return IntervalSet.of(
    InstantInterval.domain,
    existing.map((b) => b.when),
  );
}

/** The parts of `window` not covered by any busy block. */
export function freeSlots(window: Slot, busy: Busy): Busy {
  return IntervalSet.of(InstantInterval.domain, [window]).difference(busy);
}

/** Whether `request` fits inside one free slot (inside opening hours, clashing with nothing). */
export function canBook(request: Slot, free: Busy): boolean {
  return free.encloses(request);
}

/** The earliest slot of `duration` ms that fits in one free piece, or null. */
export function firstFit(free: Busy, duration: number): Slot | null {
  const fit = free.toArray().find((piece) => (piece.length() ?? 0) >= duration);
  return fit ? InstantInterval.fromStart(fit.lowerValue()!, duration) : null;
}

/** The cost of `request` under per-period hourly rates. */
export function price(request: Slot, hourly: IntervalMap<Temporal.Instant, number>): number {
  let total = 0;
  for (const [piece, rate] of hourly.subMap(request)) total += (piece.length()! / HOUR) * rate;
  return total;
}

// usage
// const free = freeSlots(openingHours, busyTime(bookingsForRoom));
// const proposal = firstFit(free, minutes(45));
// if (proposal && canBook(proposal, free)) price(proposal, hourlyRates);
```

## Where next

- [Interval overview](@BASE@/interval/): every factory and operation, including `union`,
  `symmetricDifference` and `isConnected`.
- [Interval sets and maps](@BASE@/interval/sets/): every `IntervalSet` and `IntervalMap` operation,
  `complement` on bounded domains, and the mapping from Guava's `RangeSet` / `RangeMap`.
- [Interval domains](@BASE@/interval/domains/): `PlainDateInterval` for whole-day bookings (calendar
  days are discrete, so consecutive stays merge), `ZonedDateTimeInterval`, and the decimal, semver and
  IP domains.
- [Semantics & custom types](@BASE@/interval/semantics/): discrete versus continuous domains, `±∞`, and
  `defineIntervalType` for your own ordered type.
- [Interval playground](@BASE@/playground/interval/): try the operations in the browser.
