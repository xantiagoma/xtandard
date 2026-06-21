# `Interval<T>` (`xantiagoma/interval`)

A generic, immutable interval over any ordered type — modeled on Guava's
`Range` + `DiscreteDomain`. The engine and the built-in primitive domains live in
`xantiagoma/interval` (zero dependencies). Temporal-typed intervals (Instant,
ZonedDateTime, …) ship from `xantiagoma/temporal` (peer `@js-temporal/polyfill`) —
see [Temporal intervals](#temporal-intervals).

```ts
import { NumberInterval } from "xantiagoma/interval";

const range = new NumberInterval({ start: 0, startClose: true, end: 10, endClose: false }); // [0,10)
range.contains(5); // true
range.union(NumberInterval.closedOpen(10, 20))?.toString(); // "[0,20)"
NumberInterval.parse("(-Infinity,5]").contains(-3); // true
```

## Built-in interval types

Each is a `new`-able class; the same-named `type` is its instance type.

| Class             | Element `T` | Kind                                                   |
| ----------------- | ----------- | ------------------------------------------------------ |
| `NumberInterval`  | `number`    | continuous, **extended line** (`±Infinity` includable) |
| `IntegerInterval` | `number`    | discrete (ε 1)                                         |
| `BigIntInterval`  | `bigint`    | discrete (ε 1n)                                        |
| `DateInterval`    | `Date`      | continuous (ms)                                        |
| `StringInterval`  | `string`    | continuous, lexicographic (UTF-16 code-unit)           |

Plus `createOrdinalInterval([...])` for an ordered-label "enum" domain (discrete) — also
zero-dep, see [Ordinal intervals](#ordinal-intervals). The TC39 `Temporal` types get
ready-made classes from `xantiagoma/temporal` (see [Temporal intervals](#temporal-intervals)),
and there are dedicated entries for money, exact numbers, semver, and IP addresses (below).
You can also define your own for any ordered `T` (see [Custom types](#custom-types)).

## Construction

**Spec object — explicit brackets, no defaults.** Give a side via `start`+`startClose`
(both required together) or omit it for an unbounded side. Omitting a close flag for a
provided value is a compile error.

```ts
new NumberInterval({ start: 1, startClose: true, end: 5, endClose: false }); // [1,5)
new NumberInterval({ start: 5, startClose: false }); // (5,+Infinity)
new NumberInterval({ end: 5, endClose: false }); // (-Infinity,5)
new NumberInterval(); // (-Infinity,+Infinity)
// @ts-expect-error — start needs startClose
new NumberInterval({ start: 1, end: 5 });
```

**Statics:** `closed` `open` `closedOpen` `openClosed` `point` `atLeast` `greaterThan`
`atMost` `lessThan` `all` `empty` · `fromStart(start,len)` `fromEnd(end,len)`
`fromCenter(center,len)` (half-open, need `add`) · `parse(text)`.

```ts
NumberInterval.closedOpen(1, 5); // [1,5)
NumberInterval.atLeast(0); // [0,+Infinity)
NumberInterval.parse("[1,5]"); // [1,5]
```

## Operations

All instance methods. Operations return base `Interval<T>` values (still
`instanceof Interval`).

- **Queries:** `contains(value)` · `encloses(other)` · `overlaps` · `isConnected`
  (overlap or adjacent) · `isAdjacent` · `isBefore` / `isAfter` · `isEmpty` `isFull`
  `isPoint` `isDiscrete` · `hasLowerBound` / `hasUpperBound` · `lowerValue()` /
  `upperValue()`.
- **Set composition** (mirrors JS `Set`): `union` (→ `Interval | null`, null = gap) ·
  `intersection` · `difference` (→ `Interval[]`, 0/1/2 pieces) · `symmetricDifference` ·
  `isSubsetOf` · `isSupersetOf` · `isDisjointFrom`.
- **Geometry:** `span(other)` (minimal enclosing, across gaps) · `gap(other)`
  (the hole between disjoint intervals, or null) · `middle()` (midpoint).
- **Measure / mutation:** `length()` (→ `number | null`; null if unbounded) ·
  `withStart(value, closed)` / `withEnd(value, closed)` (immutable setters) ·
  `equals(other)`.
- **Serialization:** `toString()` / `format({ negativeInfinity, positiveInfinity })`.

```ts
// difference respects open/closed boundaries exactly:
NumberInterval.closed(3, 10).difference(NumberInterval.open(4, 6)); // [3,4] ∪ [6,10]
NumberInterval.closed(3, 10).difference(NumberInterval.closed(4, 6)); // [3,4) ∪ (6,10]
```

## String form

`[a,b]` `(a,b)` `[a,b)` `(a,b]`, unbounded `(-Infinity,5]` / `[0,+Infinity)`, empty `∅`.
The canonical token `toString()` emits is `+Infinity` / `-Infinity`; `parse` is lenient
and also accepts `-inf` / `infinity` / `∞` (case-insensitive), normalizing them to the
canonical form on output. Round-trips through `toString()`. Safe to store in DB columns /
URL params.

## Discrete vs continuous (the "epsilon")

Discreteness is a property of the **domain**, decided by whether it provides a
successor `next` (the "epsilon" / step). It is **not** a class hierarchy — see
[Why composition, not inheritance](#why-composition-not-inheritance).

**Check at runtime** with `interval.isDiscrete` (`= domain.next !== undefined`).

|               | Continuous                                                  | Discrete                                                   |
| ------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| You implement | `compare` (no `next`/`prev`)                                | `compare` **+ `next` + `prev`**                            |
| Adjacency     | only exact touch + complementary closed (`[a,b]` & `(b,c]`) | gap-free by step (`[1,5]` & `[6,10]`)                      |
| Stored bounds | verbatim                                                    | canonical `[closed, open)` (displayed as friendly `[a,b]`) |
| `length()`    | a magnitude (measure)                                       | element count                                              |
| Built-ins     | `number`, `Date`                                            | `IntegerInterval`, `BigIntInterval`                        |

```ts
IntegerInterval.closed(1, 5).union(IntegerInterval.closed(6, 10))?.toString(); // "[1,10]"  (merge)
NumberInterval.closed(1, 5).union(NumberInterval.closed(6, 10)); // null     (gap)
IntegerInterval.closed(1, 5).length(); // 5 (count of {1..5})
NumberInterval.closed(1, 5).length(); // 4 (measure)
IntegerInterval.closed(1, 5).isDiscrete; // true
NumberInterval.closed(1, 5).isDiscrete; // false
```

**Implementing each:**

```ts
import type { IntervalDomain } from "xantiagoma/interval";

// CONTINUOUS — just compare (+ optional measure/format/parse). No next/prev.
const tempDomain: IntervalDomain<number> = {
  name: "celsius",
  compare: (a, b) => Math.sign(a - b),
  measure: (a, b) => b - a,
};

// DISCRETE — also a true successor/predecessor (exactly one step, nothing between).
const moneyDomain: IntervalDomain<number> = {
  name: "cents",
  compare: (a, b) => Math.sign(a - b),
  next: (v) => v + 1, // 1 cent
  prev: (v) => v - 1,
  measure: (a, b) => b - a,
};
```

**Limitations / rules:**

- `next`/`prev` must be a **true** successor/predecessor — exactly one step with no
  value in between, and consistent with `compare` (`next(v) > v`). For floats this is
  **not** possible (`Number.EPSILON` is only the gap near 1.0; the ULP grows with
  magnitude), so leave floats continuous.
- A domain is discrete **or** continuous — don't provide `next` only sometimes.
- Discrete intervals are stored canonical `[closed, open)`; `lower`/`upper` reflect that
  (e.g. `IntegerInterval.closed(1,5).upper` is `6` open). `toString()`/`length()` hide
  this. Equality is canonical: `(0,5] == [1,5]`.
- Mixing a continuous and a discrete domain of the same `T` (e.g. `NumberInterval` and
  `IntegerInterval`, both `Interval<number>`) type-checks but is meaningless — operations
  use the receiver's domain. Use one consistently.

### Why composition, not inheritance

There is a single `Interval<T>` engine; the domain is injected (Guava's `Range<C>` +
`DiscreteDomain<C>` model). We deliberately avoid an
`Interval<T> → DiscreteInterval<T> → …` hierarchy because:

- The **same** `T` can be both — `number` has a continuous domain (`numberDomain`) and a
  discrete one (`integerDomain`). With inheritance you'd need `NumberContinuousInterval`
  vs `NumberDiscreteInterval` classes; with a domain you just pick the domain.
- New types need **one object** (`IntervalDomain<T>`), not a new subclass + re-implemented
  operations.
- All the set algebra lives once on `Interval<T>` and works for every domain.

`defineIntervalType(domain)` still gives you a real `new`-able subclass per type for
ergonomics + `instanceof`, but discreteness rides on the domain, not the class.

## Extended real line (`±∞`)

A domain may declare its infinity values (`negativeInfinity`/`positiveInfinity`). When
it does — only **`number`** among the built-ins (`±Infinity`) — the bracket on an
unbounded side is **meaningful** (the affinely extended real line `ℝ̄`):

```ts
NumberInterval.parse("[-Infinity,5]").contains(-Infinity); // true
NumberInterval.parse("(-Infinity,5]").contains(-Infinity); // false
NumberInterval.parse("[3,+Infinity]").contains(Infinity); // true
// factories produce OPEN infinity:
NumberInterval.atLeast(0).contains(Infinity); // false
```

Domains **without** an infinity value (`Date`, `bigint`, `Instant`, …) have no `±∞`
element, so an unbounded side is always **open** — `[-Infinity,…]` normalizes to `(-Infinity,…)`.

## Temporal intervals

`xantiagoma/temporal` ships the engine bound to the TC39 `Temporal` types (peer
dependency `@js-temporal/polyfill`):

| Class                   | Element `T`              | Kind               |
| ----------------------- | ------------------------ | ------------------ |
| `InstantInterval`       | `Temporal.Instant`       | continuous         |
| `ZonedDateTimeInterval` | `Temporal.ZonedDateTime` | continuous         |
| `PlainDateInterval`     | `Temporal.PlainDate`     | discrete (ε 1 day) |
| `PlainDateTimeInterval` | `Temporal.PlainDateTime` | continuous         |
| `PlainTimeInterval`     | `Temporal.PlainTime`     | continuous         |

The matching domains (`instantDomain`, `zonedDateTimeDomain`, …) are exported too,
for use with `defineIntervalType` or `parseInterval`.

```ts
import { PlainDateInterval, InstantInterval } from "xantiagoma/temporal";
import { Temporal } from "@js-temporal/polyfill";

// Discrete calendar days merge gap-free:
PlainDateInterval.closed(
  Temporal.PlainDate.from("2026-01-01"),
  Temporal.PlainDate.from("2026-01-05"),
)
  .union(
    PlainDateInterval.closed(
      Temporal.PlainDate.from("2026-01-06"),
      Temporal.PlainDate.from("2026-01-10"),
    ),
  )
  ?.toString(); // "[2026-01-01,2026-01-10]"

InstantInterval.parse("[2026-01-01T00:00:00Z,2026-01-02T00:00:00Z)").length(); // 86_400_000 (ms)
```

**Precision.** Ordering, membership (`contains`), set operations, and parse/format
are **exact** — `compare` defers to `Temporal.*.compare` (nanosecond-precise for
Instant/ZonedDateTime) and the string form is round-trippable ISO. Only
`length()` / `middle()` / `fromStart` work in **milliseconds** (days for
`PlainDate`), because the engine types `measure`/`add` as a JS `number` and epoch
_nanoseconds_ overflow `Number.MAX_SAFE_INTEGER` after ~104 days; milliseconds keep
`length()` an exact integer for ~285,000 years. For sub-millisecond spans, subtract
the endpoints' `epochNanoseconds` (a `bigint`) directly.

The domains never use `instanceof Temporal.*` (only static `compare`/`from` and
instance methods), so values from any TC39-compatible polyfill order correctly.

## Decimal intervals

`xantiagoma/decimal` binds the engine to [decimal.js](https://github.com/MikeMcl/decimal.js)
`Decimal` values (peer dependency `decimal.js`) — an **exact, continuous** alternative to
`NumberInterval` for when IEEE-754 float fuzz is unacceptable:

```ts
import { DecimalInterval } from "xantiagoma/decimal";
import Decimal from "decimal.js";

const d = (s: string) => new Decimal(s);

// number leaks the representation error; decimal does not:
NumberInterval.closed(0.1, 0.3).length(); // 0.19999999999999998
DecimalInterval.closed(d("0.1"), d("0.3")).length(); // 0.2
DecimalInterval.closed(d("0.1"), d("0.3")).toString(); // "[0.1,0.3]"
DecimalInterval.parse("[1.000000000000000000000000000001,2]"); // 30 sig digits preserved
```

CONTINUOUS — decimals are dense, so there is no successor (`isDiscrete` is `false`).
`compare`, `contains`, set operations, and `toString`/`parse` are exact arbitrary-precision.
Only `measure`/`length()`/`middle()` round-trip through a JS `number` (the engine's
`measure` return type) — but the value is computed exactly first, so clean decimals report
cleanly. Members must be finite (`NaN`/`±Infinity` are rejected by `contains`).

**Same model, different backing library** — pick the one you already use; the API and
behavior are identical:

| Entry                  | Class               | Peer dep       | Notes                               |
| ---------------------- | ------------------- | -------------- | ----------------------------------- |
| `xantiagoma/decimal`   | `DecimalInterval`   | `decimal.js`   | Most full-featured (irrational ops) |
| `xantiagoma/big`       | `BigInterval`       | `big.js`       | Smallest footprint; always finite   |
| `xantiagoma/bignumber` | `BigNumberInterval` | `bignumber.js` | Base conversion; common in finance  |

## Fraction intervals

`xantiagoma/fraction` binds the engine to [fraction.js](https://github.com/rawify/Fraction.js)
`Fraction` values (peer dependency `fraction.js`) — exact **rationals**. Unlike the decimal
libraries, `1/3` is represented losslessly (it has no finite decimal expansion) and the string
form is `"1/3"`:

```ts
import { FractionInterval } from "xantiagoma/fraction";
import Fraction from "fraction.js";

const third = (n: number) => new Fraction(n, 3);

FractionInterval.closed(third(1), third(2)).toString(); // "[1/3,2/3]"
FractionInterval.closed(third(1), third(2)).contains(new Fraction(1, 2)); // true
FractionInterval.parse("[1/3,2/3]").toString(); // "[1/3,2/3]"  (round-trips, exact)
```

CONTINUOUS (rationals are dense). `compare`, `contains`, and the `"n/d"` string form are
exact rationals; `measure`/`length()`/`middle()` round-trip through a JS `number` (so a
length is a floating-point magnitude even though the endpoints stay exact).

## Money intervals

`xantiagoma/dinero` binds the engine to [dinero.js](https://dinerojs.com/) v2 values
(peer dependency `dinero.js`). Money is **discrete**: the epsilon is one minor unit at
the currency's standard `exponent` (1 cent for USD, 1 whole yen for JPY), so adjacent
ranges merge gap-free and `length()` counts representable amounts.

Because a `Dinero` value carries its currency, an interval is bound to **one currency** —
build a class with `createDineroInterval(currency)`:

```ts
import { createDineroInterval } from "xantiagoma/dinero";
import { dinero, USD } from "dinero.js";

const UsdInterval = createDineroInterval(USD);
const usd = (cents: number) => dinero({ amount: cents, currency: USD });

const tier = UsdInterval.closed(usd(5_000), usd(10_000)); // $50.00 – $100.00
tier.contains(usd(7_500)); // true
tier.length(); // 5001 (cents $50.00..$100.00 inclusive)
tier.toString(); // "[5000,10000]"  (minor units)

// epsilon-adjacent ranges merge:
UsdInterval.closed(usd(100), usd(105))
  .union(UsdInterval.closed(usd(106), usd(110)))
  ?.toString(); // "[100,110]"
```

The string form (and `parse`) is the currency's **minor units** (integer). `dineroDomain(currency)`
is exported too, for use with `defineIntervalType`/`parseInterval`.

**Precision.** `compare` defers to dinero's own (scale-aware, exact) comparison, so a
value carrying sub-minor-unit precision (a larger `scale`, e.g. `$1.2345`) is still
ordered/contained exactly. Stepping (`next`/`prev`), `measure`/`length()`, and the
string form work on the **whole-minor-unit grid** — a sub-cent value is half-even
rounded to cents there. Use whole minor units for predictable discrete behavior.

## String intervals

`StringInterval` (in `xantiagoma/interval`, **zero-dep**) orders strings
lexicographically (UTF-16 code-unit order — deterministic, not locale-aware). CONTINUOUS:
no successor and no `length()`. Useful for keyspace/shard partitioning, prefix scans, and
geohash spatial ranges (geohashes sort lexicographically).

```ts
import { StringInterval } from "xantiagoma/interval";

StringInterval.closedOpen("a", "n").contains("mango"); // true
// idiomatic prefix scan: [prefix, prefix + '￿')
StringInterval.closedOpen("user:", "user:￿").contains("user:42"); // true
```

The `[a,b]` string form splits on the FIRST comma, so values containing `,`/`[`/`]`/`(`/`)`
are not round-trippable through `parse`/`toString` (every other operation is unaffected).

## Ordinal intervals

`createOrdinalInterval(labels)` (in `xantiagoma/interval`, **zero-dep**) builds a DISCRETE
class over an ordered list of string labels — a small "enum" (sizes, priority/log levels).
Ordering is list position, so adjacent labels merge and `length()` counts labels. The
interval operates on the label **index**; `.index(label)` / `.label(i)` convert, and
`toString()`/`parse()` use the labels.

```ts
import { createOrdinalInterval } from "xantiagoma/interval";

const Size = createOrdinalInterval(["XS", "S", "M", "L", "XL"]);
const r = Size.closed(Size.index("S"), Size.index("L"));
r.toString(); // "[S,L]"
r.length(); // 3   ({S, M, L})
r.contains(Size.index("M")); // true
```

## Semver intervals

`xantiagoma/semver` binds the engine to [semver](https://github.com/npm/node-semver) version
strings (peer dependency `semver`) — a version range _is_ an interval. Useful for
compatibility windows, "affected versions" in advisories, and release gates.

```ts
import { SemverInterval } from "xantiagoma/semver";

const compatible = SemverInterval.closedOpen("1.2.0", "2.0.0"); // [1.2.0, 2.0.0)
compatible.contains("1.5.3"); // true
compatible.contains("2.0.0"); // false
compatible.contains("1.0.0-rc.1"); // false (prerelease sorts below its release)
```

CONTINUOUS — prereleases (`1.0.0-rc.1 < 1.0.0`) mean no clean successor, so there's no
`length()`/`middle()`. Ordering and membership use semver precedence; members must be valid
semver (`parse` normalizes and rejects invalid versions). `semverDomain` is exported for use
with `defineIntervalType`/`parseInterval`.

## IP intervals

`xantiagoma/ip` binds the engine to IPv4/IPv6 addresses via
[ipaddr.js](https://github.com/whitequark/ipaddr.js) (peer dependency). DISCRETE (ε = one
address), so a CIDR block is a clean range, adjacent ranges merge, and `length()` counts
addresses. Useful for firewall rules, allowlists, CIDR math, and geo-IP buckets.

```ts
import { Ipv4Interval, Ipv6Interval } from "xantiagoma/ip";

const lan = Ipv4Interval.cidr("192.168.0.0/16"); // or .closed(Ipv4Interval.ip("192.168.0.0"), …)
lan.contains(Ipv4Interval.ip("192.168.1.50")); // true
lan.length(); // 65536
lan.toString(); // "[192.168.0.0,192.168.255.255]"

Ipv6Interval.cidr("2001:db8::/32").contains(Ipv6Interval.ip("2001:db8::1")); // true
```

Addresses are modeled as their integer value (`bigint`) so arithmetic never overflows the
address space; `toString()` renders the canonical dotted (v4) / compressed (v6) form. Build
from a string with `.ip(addr)` or from a block with `.cidr(block)`.

## Edge cases

- `number`: `contains(NaN)` → `false` (not comparable); `parse("[NaN,5]")` /
  `parse("[lala,5]")` → throws. Ordering is exact, but `length()`/`middle()`/`format`
  inherit IEEE-754 fuzz (`[0.1,0.3].length()` → `0.19999999999999998`) — for exact
  decimals use [`DecimalInterval`](#decimal-intervals) or an integer-backed domain.
- `Date`: `contains(new Date("lala"))` → `false` (Invalid Date); `parse` of an invalid
  date string → throws.
- `Temporal`: there is no "Invalid Instant" sentinel — `Temporal.Instant.from("lala")`
  throws, so an invalid value can never be constructed or queried.

## `instanceof` & element-type safety

Instances are `instanceof` both the bound class and `Interval`. Operations return base
`Interval<T>` (still `instanceof Interval`). The element type `T` isolates types — a
`NumberInterval` cannot `union` an `InstantInterval` (compile error).

```ts
const r = NumberInterval.closed(0, 5);
r instanceof NumberInterval; // true
r instanceof Interval; // true
```

## Custom types

Unlike Guava (which requires `T extends Comparable`), you **inject** the ordering via an
`IntervalDomain<T>`, then bind it with `defineIntervalType`. The minimum is `name` +
`compare` (one comparator subsumes eq/lt/gt). Everything else is optional:

| Hook                                    | Enables                                             |
| --------------------------------------- | --------------------------------------------------- |
| `compare(a, b)` (required)              | ordering — `contains`, all set ops                  |
| `next` / `prev`                         | discrete domain → adjacency / merge (the "epsilon") |
| `measure(lower, upper)`                 | `length()`                                          |
| `add(value, delta)`                     | `fromStart` / `fromEnd` / `fromCenter` / `middle`   |
| `format` / `parse`                      | `toString()` / `parseInterval`                      |
| `isValid(value)`                        | reject invalid members (`NaN`, Invalid Date)        |
| `negativeInfinity` / `positiveInfinity` | includable `±∞` (extended line)                     |

```ts
import { defineIntervalType, type IntervalDomain } from "xantiagoma/interval";
import { dinero, lessThan, greaterThan, toSnapshot, type Dinero } from "dinero.js";

const dineroDomain: IntervalDomain<Dinero<number>> = {
  name: "dinero",
  compare: (a, b) => (lessThan(a, b) ? -1 : greaterThan(a, b) ? 1 : 0),
  measure: (a, b) => toSnapshot(b).amount - toSnapshot(a).amount, // optional
};

const DineroInterval = defineIntervalType(dineroDomain);
type DineroInterval = InstanceType<typeof DineroInterval>;

const millionaire = DineroInterval.atLeast(usd(100_000_000)); // [$1,000,000.00, +Infinity)
const isMillionaire = (cash: Dinero<number>) => millionaire.contains(cash);
```

Notes on the "step" (`next`/`prev`): integer/bigint use `+1`/`+1n`; money could be
`+1` minor unit (discrete → adjacent ranges merge). Floats and instants are kept
**continuous** on purpose (no true successor — float ULP grows with magnitude, and
`[1,5] ∪ [6,10]` should stay a gap), so add a step only when you want discrete merge.
