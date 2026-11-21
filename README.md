<p align="center">
  <img src="./assets/logo.png" alt="xtandard" width="120" />
</p>

<h1 align="center">xtandard</h1>

<p align="center">
  Lightweight, type-safe TypeScript utilities — zero dependencies for the core.
</p>

<p align="center">
  <a href="https://me.xantiagoma.com/xtandard/"><strong>Documentation</strong></a> ·
  <a href="https://me.xantiagoma.com/xtandard/getting-started/">Getting started</a> ·
  <a href="https://me.xantiagoma.com/xtandard/api/">API reference</a> ·
  <a href="https://me.xantiagoma.com/xtandard/playground/filters/">Playgrounds</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@xtandard/lib"><img src="https://img.shields.io/npm/v/@xtandard/lib?color=blue" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@xtandard/lib"><img src="https://img.shields.io/npm/dm/@xtandard/lib" alt="npm downloads" /></a>
  <a href="https://github.com/xantiagoma/xtandard/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@xtandard/lib" alt="license" /></a>
</p>

---

## Install

```bash
npm install @xtandard/lib
```

Release process notes live in [docs/RELEASING.md](./docs/RELEASING.md).

## Entry Points

| Import                                 | Description                                              | Dependencies                         |
| -------------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| `@xtandard/lib`                        | Core utilities (isomorphic, zero deps)                   | none                                 |
| `@xtandard/lib/interval`               | Generic `Interval<T>` (Guava Range)                      | none                                 |
| `@xtandard/lib/dinero`                 | Money intervals (`Interval` of money)                    | `dinero.js`                          |
| `@xtandard/lib/decimal`                | Exact-decimal intervals (decimal.js)                     | `decimal.js`                         |
| `@xtandard/lib/big`                    | Exact-decimal intervals (big.js)                         | `big.js`                             |
| `@xtandard/lib/bignumber`              | Exact-decimal intervals (bignumber.js)                   | `bignumber.js`                       |
| `@xtandard/lib/fraction`               | Exact-rational intervals (fraction.js)                   | `fraction.js`                        |
| `@xtandard/lib/semver`                 | Semantic-version range intervals                         | `semver`                             |
| `@xtandard/lib/ip`                     | IPv4/IPv6 address & CIDR intervals                       | `ipaddr.js`                          |
| `@xtandard/lib/pagination`             | Pagination + keyset helpers                              | none                                 |
| `@xtandard/lib/pagination/drizzle`     | Drizzle adapter for pagination keysets                   | `drizzle-orm`                        |
| `@xtandard/lib/pagination/drizzle-rqb` | Drizzle RQB v2 keyset (`where`/`orderBy` objects)        | none                                 |
| `@xtandard/lib/pagination/kysely`      | Kysely adapter for pagination keysets                    | `kysely`                             |
| `@xtandard/lib/pagination/knex`        | Knex adapter for pagination keysets                      | none                                 |
| `@xtandard/lib/pagination/sql-tag`     | Bun.sql / postgres.js keyset fragments                   | none                                 |
| `@xtandard/lib/pagination/mongo`       | Mongo/Mongoose adapter for keysets                       | none                                 |
| `@xtandard/lib/pagination/prisma`      | Prisma adapter for pagination keysets                    | none                                 |
| `@xtandard/lib/filters`                | Filter model (types) + portable compiler + sort/describe | none                                 |
| `@xtandard/lib/filters/valibot`        | Ready-made valibot schemas for the model                 | `valibot`, `@js-temporal/polyfill`   |
| `@xtandard/lib/filters/zod`            | Ready-made Zod schemas for the model                     | `zod`, `@js-temporal/polyfill`       |
| `@xtandard/lib/filters/arktype`        | Ready-made ArkType schemas for the model                 | `arktype`, `@js-temporal/polyfill`   |
| `@xtandard/lib/filters/effect`         | Ready-made Effect schemas for the model                  | `effect`, `@js-temporal/polyfill`    |
| `@xtandard/lib/filters/drizzle`        | Drizzle WHERE builder + keyset from filters              | `drizzle-orm`                        |
| `@xtandard/lib/filters/drizzle-rqb`    | Drizzle RQB v2 `where` object from filters (`db.query`)  | none                                 |
| `@xtandard/lib/filters/kysely`         | Kysely WHERE builder from filters                        | `kysely`                             |
| `@xtandard/lib/filters/knex`           | Knex raw-SQL WHERE builder from filters                  | none                                 |
| `@xtandard/lib/filters/sql-tag`        | Bun.sql / postgres.js fragments from filters             | none                                 |
| `@xtandard/lib/filters/mongo`          | Mongo filter object from filters                         | none                                 |
| `@xtandard/lib/filters/prisma`         | Prisma `where` object from filters                       | none                                 |
| `@xtandard/lib/filters/memory`         | In-memory predicate, comparator + array pagination       | none                                 |
| `@xtandard/lib/filters/tanstack-table` | TanStack Table state ⇄ filters, sort, pagination         | none                                 |
| `@xtandard/lib/web`                    | Browser/FormData utilities                               | `up-fetch`                           |
| `@xtandard/lib/tanstack`               | nuqs-style URL query state (TanStack Router)             | `react`, `@tanstack/react-router`    |
| `@xtandard/lib/tanstack/server`        | Framework-free parsers/serializer/loader                 | none                                 |
| `@xtandard/lib/tanstack/testing`       | Headless testing adapter (no router)                     | `react`                              |
| `@xtandard/lib/tanstack/temporal`      | Temporal-kind URL parsers                                | `@js-temporal/polyfill`, `valibot`   |
| `@xtandard/lib/tanstack/rison`         | Rison value codec for `parseAsCodec`                     | `@effective/rison`, `valibot`        |
| `@xtandard/lib/ulid`                   | Prefixed ULID generation + helpers                       | `ulid`                               |
| `@xtandard/lib/temporal`               | Date/time/duration + Temporal intervals                  | `@js-temporal/polyfill`, `itty-time` |
| `@xtandard/lib/dataloader`             | DataLoader factory                                       | `dataloader`                         |
| `@xtandard/lib/unstorage`              | Cache helpers with unstorage                             | `unstorage`, `ohash`                 |
| `@xtandard/lib/valibot`                | `TimeZone`, duration & Temporal schemas (valibot)        | `valibot`, `@js-temporal/polyfill`   |
| `@xtandard/lib/zod`                    | Branded `TimeZone` schema (Zod)                          | `zod`                                |
| `@xtandard/lib/arktype`                | Branded `TimeZone` schema (ArkType)                      | `arktype`                            |
| `@xtandard/lib/effect`                 | Branded `TimeZone` schema (Effect)                       | `effect`                             |
| `@xtandard/lib/sonner`                 | Toast streaming for iterables                            | `sonner`, `react`                    |
| `@xtandard/lib/react`                  | React hooks + components                                 | `react`, `@tanstack/react-query`     |

Sub-entry dependencies are **optional peer deps** — only install what you use.

## Core Utilities (`@xtandard/lib`)

### Error Handling

| Export                      | Description                                  | Source                          | Tests                                   |
| --------------------------- | -------------------------------------------- | ------------------------------- | --------------------------------------- |
| `tryCatch`                  | `[data, error]` tuples — sync/async adaptive | [src](./src/try-catch.ts)       | [tests](./test/try-catch.test.ts)       |
| `tryCatchSync` (deprecated) | Use `tryCatch` — kept for backwards compat   | [src](./src/try-catch.ts)       | [tests](./test/try-catch.test.ts)       |
| `assertNotNull`             | Throws if null/undefined, narrows type       | [src](./src/assert-not-null.ts) | [tests](./test/assert-not-null.test.ts) |
| `valueOrThrow`              | Returns value or throws                      | [src](./src/error.ts)           | [tests](./test/error.test.ts)           |
| `AssertError`               | Custom error class                           | [src](./src/errors.ts)          | [tests](./test/errors.test.ts)          |

### Async

| Export                | Description                              | Source                                | Tests                                         |
| --------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `wait`                | Typed setTimeout delay                   | [src](./src/wait.ts)                  | [tests](./test/wait.test.ts)                  |
| `Completer`           | Externally resolvable Promise            | [src](./src/completer.ts)             | [tests](./test/completer.test.ts)             |
| `collect`             | Drain any iterable into `T[]` (adaptive) | [src](./src/collect.ts)               | [tests](./test/collect.test.ts)               |
| `asyncOf`             | Create `AsyncGenerator` from values      | [src](./src/async-of.ts)              | [tests](./test/async-of.test.ts)              |
| `AsyncChannel`        | Push-based `AsyncIterable` with modes    | [src](./src/async-channel.ts)         | [tests](./test/async-channel.test.ts)         |
| `resolveMaybePromise` | Resolve `T \| Promise<T>` → `Promise<T>` | [src](./src/resolve-maybe-promise.ts) | [tests](./test/resolve-maybe-promise.test.ts) |

### Iterables & Generators

| Export                | Description                                         | Source                            | Tests                                     |
| --------------------- | --------------------------------------------------- | --------------------------------- | ----------------------------------------- |
| `range` / `rangeLazy` | Numeric range (array / generator)                   | [src](./src/range.ts)             | [tests](./test/range.test.ts)             |
| `enumerate`           | `[index, value]` tuples — sync/async adaptive       | [src](./src/enumerate.ts)         | [tests](./test/enumerate.test.ts)         |
| `enumerateAsync`      | Always-async; awaits Promise values in sync sources | [src](./src/enumerate.ts)         | [tests](./test/enumerate.test.ts)         |
| `toIterator`          | Normalize to `Iterator`                             | [src](./src/to-iterator.ts)       | [tests](./test/to-iterator.test.ts)       |
| `toAsyncIterable`     | Normalize to `AsyncGenerator`                       | [src](./src/to-async-iterable.ts) | [tests](./test/to-async-iterable.test.ts) |

### Type Guards

| Export                                                    | Description            | Source                             | Tests                                      |
| --------------------------------------------------------- | ---------------------- | ---------------------------------- | ------------------------------------------ |
| `isPromise`                                               | Promise-like check     | [src](./src/is-promise.ts)         | [tests](./test/is-promise.test.ts)         |
| `isIterable`                                              | `Iterable` check       | [src](./src/is-iterable.ts)        | [tests](./test/is-iterable.test.ts)        |
| `isAsyncIterable`                                         | `AsyncIterable` check  | [src](./src/is-async-iterable.ts)  | [tests](./test/is-async-iterable.test.ts)  |
| `isIterator`                                              | `Iterator` check       | [src](./src/is-iterator.ts)        | [tests](./test/is-iterator.test.ts)        |
| `isGenerator`                                             | `Generator` check      | [src](./src/is-generator.ts)       | [tests](./test/is-generator.test.ts)       |
| `isAsyncGenerator`                                        | `AsyncGenerator` check | [src](./src/is-async-generator.ts) | [tests](./test/is-async-generator.test.ts) |
| `isDisposable` / `isAsyncDisposable` / `isSyncDisposable` | Disposable checks      | [src](./src/is-disposable.ts)      | [tests](./test/is-disposable.test.ts)      |

### Disposable Utilities

| Export                | Description                             | Source                          | Tests                                   |
| --------------------- | --------------------------------------- | ------------------------------- | --------------------------------------- |
| `defer` / `deferSync` | Cancellable `using`/`await using`       | [src](./src/defer.ts)           | [tests](./test/defer.test.ts)           |
| `makeDisposable`      | Add `Symbol.asyncDispose` to any object | [src](./src/make-disposable.ts) | [tests](./test/make-disposable.test.ts) |

### Strings

| Export                                                          | Description      | Source                 | Tests                          |
| --------------------------------------------------------------- | ---------------- | ---------------------- | ------------------------------ |
| `ensureString` / `naturalSortCompare` / `jaroWinklerSimilarity` | String utilities | [src](./src/string.ts) | [tests](./test/string.test.ts) |

### Misc

| Export                                      | Description                             | Source                                | Tests                                         |
| ------------------------------------------- | --------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `cast<T>`                                   | Unsafe `as T` type cast                 | [src](./src/cast.ts)                  | [tests](./test/cast.test.ts)                  |
| `log`                                       | `console.log` that returns its argument | [src](./src/log.ts)                   | [tests](./test/log.test.ts)                   |
| `prepareLoaderResult`                       | Map DB rows to DataLoader key order     | [src](./src/prepare-loader-result.ts) | [tests](./test/prepare-loader-result.test.ts) |
| `resolveStreamSource`                       | Resolve `StreamSource<T>`               | [src](./src/stream-source.ts)         | [tests](./test/stream-source.test.ts)         |
| `secondsToMs` / `minutesToMs` / `hoursToMs` | Time unit converters                    | [src](./src/time-convert.ts)          | [tests](./test/time-convert.test.ts)          |

## Interval Utilities (`@xtandard/lib/interval`)

A generic, immutable `Interval<T>` over any ordered type — modeled on Guava's
`Range` + `DiscreteDomain`. The engine knows nothing about `T` except through an
injected `IntervalDomain<T>` (compare, optional successor/measure/format/parse,
and the domain's `±∞` values). Zero dependencies. **Full guide:
[docs/INTERVAL.md](./docs/INTERVAL.md).**

```ts
import { NumberInterval, IntegerInterval } from "@xtandard/lib/interval";

const r = new NumberInterval({ start: 0, startClose: true, end: 10, endClose: false }); // [0,10)
r.contains(5); // true
r.union(NumberInterval.closedOpen(10, 20))?.toString(); // "[0,20)"
NumberInterval.parse("(-Infinity,5]").contains(-3); // true

// discrete domains merge epsilon-adjacent ranges:
IntegerInterval.closed(1, 5).union(IntegerInterval.closed(6, 10))?.toString(); // "[1,10]"
```

`IntervalSet` and `IntervalMap` (Guava `RangeSet` / `RangeMap`) hold many intervals over any
domain: a normalized set of disjoint intervals with the full set algebra, and a map from
disjoint intervals to values — see
[docs/INTERVAL.md](./docs/INTERVAL.md#interval-sets-and-maps).

```ts
import { IntervalMap, IntervalSet, NumberInterval } from "@xtandard/lib/interval";

const busy = IntervalSet.of(NumberInterval.domain, [
  NumberInterval.closedOpen(9, 11),
  NumberInterval.closedOpen(10, 12), // overlaps → coalesced
  NumberInterval.closedOpen(14, 15),
]);
busy.toString(); // "[9,12) ∪ [14,15)"
busy.gaps().toString(); // "[12,14)"
busy.complement().subSet(NumberInterval.closedOpen(8, 18)).toString(); // "[8,9) ∪ [12,14) ∪ [15,18)"

const rate = IntervalMap.of(NumberInterval.domain, [
  [NumberInterval.closedOpen(0, 24), 100],
  [NumberInterval.closedOpen(18, 24), 150], // overwrites the evening
]);
rate.get(20); // 150
rate.toString(); // "{[0,18) => 100, [18,24) => 150}"
```

| Export                                                                                      | Description                                             | Source                           | Tests                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------- | ---------------------------------------- |
| `Interval`                                                                                  | Immutable interval engine (set algebra over a domain)   | [src](./src/interval.ts)         | [tests](./test/interval.test.ts)         |
| `defineIntervalType`                                                                        | Bind a domain → `new`-able interval class + statics     | [src](./src/interval.ts)         | [tests](./test/interval.test.ts)         |
| `parseInterval` / `mergeIntervals`                                                          | Parse `[a,b)` strings; merge a bag into disjoint pieces | [src](./src/interval.ts)         | [tests](./test/interval.test.ts)         |
| `numberDomain` / `integerDomain` / `bigIntDomain` / `dateDomain` / `stringDomain`           | Built-in `IntervalDomain<T>`s (zero-dep)                | [src](./src/interval-domains.ts) | [tests](./test/interval-domains.test.ts) |
| `NumberInterval` / `IntegerInterval` / `BigIntInterval` / `DateInterval` / `StringInterval` | Ready-to-use classes (incl. lexicographic strings)      | [src](./src/interval-domains.ts) | [tests](./test/interval-domains.test.ts) |
| `createOrdinalInterval(labels)`                                                             | Discrete intervals over an ordered label list (enums)   | [src](./src/interval-domains.ts) | [tests](./test/interval-domains.test.ts) |
| `IntervalSet`                                                                               | Normalized set of disjoint intervals (Guava `RangeSet`) | [src](./src/interval-set.ts)     | [tests](./test/interval-set.test.ts)     |
| `IntervalMap`                                                                               | Disjoint intervals → values (Guava `RangeMap`)          | [src](./src/interval-map.ts)     | [tests](./test/interval-map.test.ts)     |

**Temporal intervals** (`@xtandard/lib/temporal`, peer `@js-temporal/polyfill`) — the
same engine bound to the TC39 `Temporal` types:
`InstantInterval`, `ZonedDateTimeInterval`, `PlainDateInterval` (discrete, ε 1 day),
`PlainDateTimeInterval`, `PlainTimeInterval` (+ the matching `instantDomain` … exports).
Ordering/membership are nanosecond-exact; `length()`/`middle()` are millisecond-granular
(day-granular for `PlainDate`) — see [docs/INTERVAL.md](./docs/INTERVAL.md#temporal-intervals).

```ts
import { PlainTimeInterval, InstantInterval } from "@xtandard/lib/temporal";
import { Temporal } from "@js-temporal/polyfill";

const shift = PlainTimeInterval.closedOpen(
  Temporal.PlainTime.from("09:00"),
  Temporal.PlainTime.from("17:00"),
);
shift.contains(Temporal.PlainTime.from("12:30")); // true
shift.length(); // 28_800_000 (ms = 8h)
```

**Money intervals** (`@xtandard/lib/dinero`, peer `dinero.js`) — the engine bound to
dinero.js v2 values, **discrete** with the epsilon being one minor unit (1 cent for
USD, 1 yen for JPY) so adjacent ranges merge and `length()` counts amounts. Build a
class per currency with `createDineroInterval(currency)` — see
[docs/INTERVAL.md](./docs/INTERVAL.md#money-intervals).

```ts
import { createDineroInterval } from "@xtandard/lib/dinero";
import { dinero, USD } from "dinero.js";

const UsdInterval = createDineroInterval(USD);
const tier = UsdInterval.closed(
  dinero({ amount: 5_000, currency: USD }),
  dinero({ amount: 10_000, currency: USD }),
);
tier.contains(dinero({ amount: 7_500, currency: USD })); // true ($75 ∈ [$50, $100])
tier.toString(); // "[5000,10000]"  (minor units)
```

**Decimal intervals** (`@xtandard/lib/decimal`, peer `decimal.js`) — an exact, continuous
alternative to `NumberInterval` when IEEE-754 float fuzz is unacceptable. Ordering,
membership, and the string form are exact arbitrary-precision; see
[docs/INTERVAL.md](./docs/INTERVAL.md#decimal-intervals).

```ts
import { DecimalInterval } from "@xtandard/lib/decimal";
import Decimal from "decimal.js";

DecimalInterval.closed(new Decimal("0.1"), new Decimal("0.3")).length(); // 0.2 (not 0.19999999999999998)
DecimalInterval.closed(new Decimal("0.1"), new Decimal("0.3")).toString(); // "[0.1,0.3]"
```

Same exact-decimal model, different backing library (pick the one you already use):
**`@xtandard/lib/big`** (`BigInterval`, peer `big.js` — smaller) and **`@xtandard/lib/bignumber`**
(`BigNumberInterval`, peer `bignumber.js`).

**Fraction intervals** (`@xtandard/lib/fraction`, peer `fraction.js`) — exact **rationals**:
`1/3` is lossless (never rounds, even where decimals can't) and renders as `"1/3"`. See
[docs/INTERVAL.md](./docs/INTERVAL.md#fraction-intervals).

```ts
import { FractionInterval } from "@xtandard/lib/fraction";
import Fraction from "fraction.js";

const third = (n: number) => new Fraction(n, 3);
FractionInterval.closed(third(1), third(2)).toString(); // "[1/3,2/3]"
FractionInterval.closed(third(1), third(2)).contains(new Fraction(1, 2)); // true
```

**Semver intervals** (`@xtandard/lib/semver`, peer `semver`) — a version range IS an interval
(`[">=1.2.0","<2.0.0")`). Exact precedence ordering; see
[docs/INTERVAL.md](./docs/INTERVAL.md#semver-intervals).

```ts
import { SemverInterval } from "@xtandard/lib/semver";

const compatible = SemverInterval.closedOpen("1.2.0", "2.0.0");
compatible.contains("1.5.3"); // true
compatible.contains("2.0.0"); // false
```

**IP intervals** (`@xtandard/lib/ip`, peer `ipaddr.js`) — IPv4/IPv6 ranges, discrete (ε = one
address), CIDR-aware. See [docs/INTERVAL.md](./docs/INTERVAL.md#ip-intervals).

```ts
import { Ipv4Interval } from "@xtandard/lib/ip";

const lan = Ipv4Interval.cidr("192.168.0.0/16");
lan.contains(Ipv4Interval.ip("192.168.1.50")); // true
lan.length(); // 65536
```

Strings and ordered enums need no extra dependency — `StringInterval` (lexicographic) and
`createOrdinalInterval([...])` (ordered labels) ship in `@xtandard/lib/interval`.

## Pagination Utilities (`@xtandard/lib/pagination`)

Source-agnostic pagination: import from `@xtandard/lib/pagination`, provide fetchers for your data source (SQL, Drizzle, Prisma, Mongoose, HTTP...), and the paginator handles input styles (`page`/`pageSize`, `limit`/`offset`, cursor), `hasNextPage` lookahead, backward (scroll-up) pagination, and a uniform result envelope. **Full guide: [docs/PAGINATION.md](./docs/PAGINATION.md)** — backend recipes for SQL drivers, ORMs/query builders, Mongo, Firestore, DynamoDB, Redis sorted sets, Elasticsearch/OpenSearch, analytics warehouses, HTTP APIs, REST/GraphQL endpoints, cursor codecs, and frontend integration.

Sync/async adaptive: pass all-sync fetchers and codec (e.g. an in-memory array) and `paginate()` returns plain values — no `await` needed; any async piece (even just an async cursor encoder) makes results Promises, reflected in the types. The pattern is documented in [docs/sync-async-adaptive.md](./docs/sync-async-adaptive.md).

| Import                                 | Export                      | Description                                                                | Source                                 | Tests                                          |
| -------------------------------------- | --------------------------- | -------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| `@xtandard/lib/pagination`             | `createPaginator`           | Paginator over user-provided fetchers; `pages()`/`items()` async iteration | [src](./src/pagination.ts)             | [tests](./test/pagination.test.ts)             |
| `@xtandard/lib/pagination`             | `toOffsetWindow`            | Page/offset input → `{ limit, offset }`                                    | [src](./src/pagination.ts)             | [tests](./test/pagination.test.ts)             |
| `@xtandard/lib/pagination`             | `createCursorCodec`         | Pluggable opaque-cursor codec (JSON + base64url)                           | [src](./src/cursor-codec.ts)           | [tests](./test/cursor-codec.test.ts)           |
| `@xtandard/lib/pagination`             | `createKeysetSpec`          | Portable keyset `where()`/`orderBy()` AST                                  | [src](./src/keyset.ts)                 | [tests](./test/keyset.test.ts)                 |
| `@xtandard/lib/pagination`             | `keysetSqlExpression`       | Mark server-owned computed SQL expressions for raw keyset helpers          | [src](./src/keyset.ts)                 | [tests](./test/keyset.test.ts)                 |
| `@xtandard/lib/pagination`             | `toKeysetWhereSql`          | Keyset `WHERE` → parameterized SQL + params                                | [src](./src/keyset.ts)                 | [tests](./test/keyset.test.ts)                 |
| `@xtandard/lib/pagination`             | `toKeysetOrderBySql`        | Keyset order → SQL `ORDER BY` fragment                                     | [src](./src/keyset.ts)                 | [tests](./test/keyset.test.ts)                 |
| `@xtandard/lib/pagination/drizzle`     | `toDrizzleKeyset`           | Keyset AST → Drizzle `where`/`orderBy` helpers                             | [src](./src/pagination-drizzle.ts)     | [tests](./test/pagination-drizzle.test.ts)     |
| `@xtandard/lib/pagination/drizzle-rqb` | `toDrizzleRqbKeyset`        | Keyset AST → Drizzle RQB v2 `where`/`orderBy` objects (`db.query`)         | [src](./src/pagination-drizzle-rqb.ts) | [tests](./test/pagination-drizzle-rqb.test.ts) |
| `@xtandard/lib/pagination/kysely`      | `toKyselyKeyset`            | Keyset AST → Kysely `where`/`orderBy` helpers                              | [src](./src/pagination-kysely.ts)      | [tests](./test/pagination-kysely.test.ts)      |
| `@xtandard/lib/pagination/knex`        | `applyKeysetToKnex`         | Apply keyset AST to Knex `whereRaw`/`orderByRaw`                           | [src](./src/pagination-knex.ts)        | [tests](./test/pagination-knex.test.ts)        |
| `@xtandard/lib/pagination/sql-tag`     | `toSqlTagKeyset`            | Keyset AST → Bun.sql / postgres.js `where`/`orderBy` fragments             | [src](./src/pagination-sql-tag.ts)     | [tests](./test/pagination-sql-tag.test.ts)     |
| `@xtandard/lib/pagination/mongo`       | `toMongoKeyset`             | Keyset AST → Mongo/Mongoose `filter`/`sort` objects                        | [src](./src/pagination-mongo.ts)       | [tests](./test/pagination-mongo.test.ts)       |
| `@xtandard/lib/pagination/prisma`      | `toPrismaKeyset`            | Keyset AST → Prisma `where`/`orderBy` objects                              | [src](./src/pagination-prisma.ts)      | [tests](./test/pagination-prisma.test.ts)      |
| `@xtandard/lib/pagination`             | `parsePaginationParams`     | Query params → `PaginationInput` (with clamping)                           | [src](./src/pagination-params.ts)      | [tests](./test/pagination-params.test.ts)      |
| `@xtandard/lib/pagination`             | `fromRelayArgs`             | Relay `first`/`after`/`last`/`before` → input                              | [src](./src/pagination-params.ts)      | [tests](./test/pagination-params.test.ts)      |
| `@xtandard/lib/pagination`             | `toRelayConnection`         | Result → Relay connection (`edges`, `pageInfo`)                            | [src](./src/pagination-output.ts)      | [tests](./test/pagination-output.test.ts)      |
| `@xtandard/lib/pagination`             | `toRestEnvelope`            | Result → `{ data, meta }` REST envelope                                    | [src](./src/pagination-output.ts)      | [tests](./test/pagination-output.test.ts)      |
| `@xtandard/lib/pagination`             | `infinitePaginationOptions` | TanStack `useInfiniteQuery` config (dep-free)                              | [src](./src/pagination-output.ts)      | [tests](./test/pagination-output.test.ts)      |

```ts
import {
  createPaginator,
  fromRelayArgs,
  parsePaginationParams,
  toRestEnvelope,
} from "@xtandard/lib/pagination";

const paginator = createPaginator({
  fetchOffset: ({ limit, offset }) => ({ items: db.query(/* LIMIT/OFFSET */) }),
  fetchCursor: ({ limit, cursor, direction }) => ({ items: db.query(/* keyset */) }),
  cursor: { fromItem: (u) => ({ id: u.id }) }, // codec optional — defaults to JSON + base64url
  maxLimit: 100,
});

// REST route
const result = await paginator.paginate(parsePaginationParams(url.searchParams));
return Response.json(toRestEnvelope(result));

// GraphQL/Relay resolver
const result = await paginator.paginate(fromRelayArgs(args));
return toRelayConnection(result, paginator.cursorFor);
```

Cursor tokens are produced by a two-stage codec (`serializer` + `encoder`, both replaceable) signature-compatible with [drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor), so the same custom encoder/decoder (encryption, signing...) can be shared between both.

## Web Utilities (`@xtandard/lib/web`)

| Export                  | Description                         | Source                                    | Tests                                       |
| ----------------------- | ----------------------------------- | ----------------------------------------- | ------------------------------------------- |
| `formDataToObject`      | `FormData` → plain object           | [src](./src/form-data-to-object-utils.ts) | [tests](./test/form-data-to-object.test.ts) |
| `fetchWithProgress`     | Fetch with upload/download progress | [src](./src/fetch-with-progress.ts)       | [tests](./test/fetch-with-progress.test.ts) |
| `createHttpInterceptor` | Intercept fetch + XHR with rules    | [src](./src/intercept-http.ts)            | [tests](./test/intercept-http.test.tsx)     |

## Sonner Utilities (`@xtandard/lib/sonner`)

Toast helpers for streaming iterables/generators through [Sonner](https://sonner.emilkowal.ski/).

| Export             | Description                                                           | Source                       | Tests                                |
| ------------------ | --------------------------------------------------------------------- | ---------------------------- | ------------------------------------ |
| `toastStream`      | Blocking/awaitable stream toast; resolves to `{ items, returnValue }` | [src](./src/toast-stream.ts) | [tests](./test/toast-stream.test.ts) |
| `toastStreamAsync` | Non-blocking stream toast; returns `{ id, unwrap }` immediately       | [src](./src/toast-stream.ts) | [tests](./test/toast-stream.test.ts) |

Use `toastStream` when the caller should wait for completion:

```ts
import { toastStream } from "@xtandard/lib/sonner";

const { items, returnValue } = await toastStream(source, {
  loading: "Loading...",
  streaming: ({ count }) => `Received ${count}`,
  success: ({ count }) => `Done: ${count} items`,
});
```

Use `toastStreamAsync` when the caller should continue immediately, in the
spirit of Sonner's `toast.promise(...).unwrap()`. It returns `{ id, unwrap }`:

```ts
import { toastStreamAsync } from "@xtandard/lib/sonner";

const { id, unwrap } = toastStreamAsync(source, { loading: "Loading..." });
// `id` is Sonner's toast id, e.g. for toast.dismiss(id)
const { items, returnValue } = await unwrap();
```

## React Utilities (`@xtandard/lib/react`)

| Export                         | Description                         | Source                                 | Tests                                           |
| ------------------------------ | ----------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `Providers` / `provider`       | Compose providers without nesting   | [src](./src/providers.tsx)             | [tests](./test/providers.test.tsx)              |
| `usePreventAutoFocus`          | Prevent auto-focus in modals        | [src](./src/use-prevent-auto-focus.ts) | [tests](./test/use-prevent-auto-focus.test.tsx) |
| `useDynamicRefs`               | Dynamic ref registry by key         | [src](./src/use-dynamic-refs.ts)       | [tests](./test/use-dynamic-refs.test.tsx)       |
| `useStream` / `StreamRenderer` | Stream consumption hook + component | [src](./src/stream-renderer.tsx)       | [tests](./test/stream-renderer.test.tsx)        |

## TanStack URL State (`@xtandard/lib/tanstack`)

nuqs-style, **component-owned** URL query state for TanStack Router (and Start).
`useQueryState` behaves like `useState`, but backed by the URL — reusable
components own "their" query key without importing a route object. Per-key
parsers, an optimistic store, rate-limited URL commits, shallow-by-default
updates, atomic multi-key batching, a framework-free server/loader/serializer
core, and a `validateSearch`-ready Standard Schema. **Full guide:
[docs/TANSTACK.md](./docs/TANSTACK.md).**

```tsx
import { NuqsAdapter, useQueryState, parseAsInteger } from "@xtandard/lib/tanstack";

// once, inside RouterProvider (e.g. your __root route component):
<NuqsAdapter>{/* app */}</NuqsAdapter>;

function Pagination() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  return <button onClick={() => setPage((p) => p + 1)}>Next</button>; // setPage(null) removes the key
}
```

| Import                            | Export                                                                        | Description                                            | Source                                             |
| --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `@xtandard/lib/tanstack`          | `useQueryState` / `useQueryStates` / `useUrlSearchString`                     | nuqs-style hooks backed by the URL                     | [src](./src/tanstack/react/)                       |
| `@xtandard/lib/tanstack`          | `NuqsAdapter` / `TanStackQueryStateAdapter`                                   | Bridges the store to TanStack Router                   | [src](./src/tanstack/adapters/tanstack-router.tsx) |
| `@xtandard/lib/tanstack`          | `parseAs*` (15 built-ins) / `createParser` / `parseAsCodec` / `withTransport` | Per-key parsers + custom codec/transport combinators   | [src](./src/tanstack/core/built-in-parsers.ts)     |
| `@xtandard/lib/tanstack/server`   | `createLoader` / `createSerializer` / `createStandardSchemaV1`                | Framework-free (loaders, `validateSearch`, server fns) | [src](./src/tanstack/server.ts)                    |
| `@xtandard/lib/tanstack/testing`  | `QueryStateTestingAdapter`                                                    | Drive hooks from a static search string, no router     | [src](./src/tanstack/adapters/testing.tsx)         |
| `@xtandard/lib/tanstack/temporal` | `parseAsInstant` / `parseAsPlainDate` / … / `parseAsTimeZone`                 | URL parsers for the six Temporal kinds                 | [src](./src/tanstack/temporal.ts)                  |
| `@xtandard/lib/tanstack/rison`    | `risonCodec`                                                                  | Readable, canonical Rison codec for `parseAsCodec`     | [src](./src/tanstack/rison.ts)                     |

`keepSubDelims` (keep `( ) , : ! '` raw in the address bar, e.g. for Rison
tokens) lives in [`@xtandard/lib/web`](#web-utilities-xtandardlibweb) and is also
re-exported from `@xtandard/lib/tanstack`.

## Filters (`@xtandard/lib/filters`)

One typed filter system spanning frontend ↔ API ↔ any query builder, built like
`pagination`: a **portable core** + **per-driver adapters**. **Full guide:
[docs/FILTERS.md](./docs/FILTERS.md).**

- **Core (`@xtandard/lib/filters`)** is **validation-library-free** and
  **driver-free**: the model is plain TS types (a two-level discriminated union —
  `kind` × Drizzle-aligned `operator`), and `compileFilters({ spec, filters,
resolveDate })` lowers a request to a **portable `CompiledWhere` AST**. Validate
  the request with whatever you use (valibot/zod/arktype/effect/…) — the core
  never imports one.
- **Validation (optional):** ready-made schemas for **valibot, Zod, ArkType, and
  Effect** at `@xtandard/lib/filters/{valibot,zod,arktype,effect}` that validate
  into the model types (a `*.test-d.ts` asserts each one has no drift). Or bring
  your own Standard Schema.
- **Adapters** render the AST per driver:
  `@xtandard/lib/filters/{drizzle,kysely,knex,mongo,prisma}` — each with typed
  `dateField`/`textField`/… spec builders (allow-list) + `buildWhere`.
  `@xtandard/lib/filters/memory` evaluates the same AST in memory: a
  `(row) => boolean` with SQL semantics, a sort comparator and synchronous
  array pagination (client-side tables, tests, an in-browser "server").
- The **`date` kind is injected** — its DST-aware `resolveDate` (→ `[gte, lt)`)
  and chip-label `describeDate` are passed in, so no date library is bundled.
- **TanStack Table** (`@xtandard/lib/filters/tanstack-table`, zero deps, v8 and
  v9): a per-column spec converts `columnFilters` / `globalFilter` / `sorting` /
  `pagination` to and from the model, so a `manual*` table is filtered, sorted
  and paged on the server and synced to the URL.

```ts
import { FiltersRequestSchema } from "@xtandard/lib/filters/valibot"; // optional validation
import { buildWhere, textField, numberField, dateField } from "@xtandard/lib/filters/drizzle";
import * as v from "valibot";

const filters = v.parse(FiltersRequestSchema, await req.json());
const spec = {
  name: textField({ column: t.name }),
  amount: numberField({ column: t.amount }),
  createdAt: dateField({ column: t.createdAt }),
};
const { where } = buildWhere({ spec, filters, resolveDate }); // resolveDate injected for `date`
db.select().from(t).where(where);
```

| Import                                               | Export                                                                                                      | Source                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `@xtandard/lib/filters`                              | model **types** (`FieldFilter`/`ColumnFilter`/`FilterNode`/`DatePreset`/…)                                  | [src](./src/filters/types.ts)       |
| `@xtandard/lib/filters`                              | `compileFilters`/`compileFilterNode` → `CompiledWhere` (+ `DateFilterResolver`)                             | [src](./src/filters/compile.ts)     |
| `@xtandard/lib/filters`                              | `*_OPERATORS` / `OPERATORS_BY_KIND` / `parseSortParam` / `describeFieldFilter` / `ResourceMetadata`         | [src](./src/filters/)               |
| `@xtandard/lib/filters/{valibot,zod,arktype,effect}` | `FieldFilterSchema` / `FiltersRequestSchema` / `FilterNodeSchema` / `SortSchema` (same names per validator) | [src](./src/filters/)               |
| `@xtandard/lib/filters/drizzle`                      | `buildWhere`/`buildFilterNode`, `dateField`/…, `buildOrderBy`, `createDrizzleKeyset`                        | [src](./src/filters/drizzle/)       |
| `@xtandard/lib/filters/drizzle-rqb`                  | `buildWhere`/`buildFilterNode` → RQB v2 `where` object (`db.query`), `dateField`/…                          | [src](./src/filters/drizzle-rqb.ts) |
| `@xtandard/lib/filters/kysely`                       | `buildWhere`/`buildOrderBy` (+ `toKyselyWhere`)                                                             | [src](./src/filters/kysely.ts)      |
| `@xtandard/lib/filters/knex`                         | `buildWhereSql`/`applyFiltersToKnex` (raw, parameterized)                                                   | [src](./src/filters/knex.ts)        |
| `@xtandard/lib/filters/sql-tag`                      | `buildWhere`/`buildOrderBy` → Bun.sql / postgres.js fragments (+ `toSqlTagWhere`)                           | [src](./src/filters/sql-tag.ts)     |
| `@xtandard/lib/filters/mongo`                        | `buildFilter` → Mongo filter object                                                                         | [src](./src/filters/mongo.ts)       |
| `@xtandard/lib/filters/prisma`                       | `buildWhere` → Prisma `where` object                                                                        | [src](./src/filters/prisma.ts)      |
| `@xtandard/lib/filters/memory`                       | `buildFilterPredicate` → `(row) => boolean` (SQL semantics), `buildComparator`, `createMemoryPaginator`     | [src](./src/filters/memory.ts)      |
| `@xtandard/lib/filters/tanstack-table`               | `createTableBridge` + `textColumn`/`numberRangeColumn`/…, `toSort`, `toPagination`, `toCursorPagination`    | [src](./src/filters/)               |

## Recommended Libraries

Libraries we use and recommend alongside xtandard. They're not re-exported: install them directly.

<!-- recs:start -->
<!-- Generated by `bun run recs:generate` from recs/libraries.ts. Do not edit by hand. -->

116 libraries in 22 categories. Search and filter them, with each one's latest release and examples of using them with xtandard, on the [docs site](https://me.xantiagoma.com/xtandard/project/recommended-libraries/). To suggest one, see [How to add a recommendation](./docs/RECOMMENDING.md).

[Language & data utilities](#language--data-utilities) · [Errors & results](#errors--results) · [Async, concurrency & resilience](#async-concurrency--resilience) · [Caching & storage](#caching--storage) · [Numbers, money & units](#numbers-money--units) · [Dates, time & scheduling](#dates-time--scheduling) · [IDs & hashing](#ids--hashing) · [Parsing & formats](#parsing--formats) · [HTTP clients & URLs](#http-clients--urls) · [Servers & APIs](#servers--apis) · [Databases & ORMs](#databases--orms) · [Auth & permissions](#auth--permissions) · [Payments](#payments) · [Background jobs & workflows](#background-jobs--workflows) · [AI](#ai) · [Email, chat & notifications](#email-chat--notifications) · [Search](#search) · [React: state, data & routing](#react-state-data--routing) · [React: UI components](#react-ui-components) · [Styling & animation](#styling--animation) · [Documents, media & devices](#documents-media--devices) · [CLI, logging & tooling](#cli-logging--tooling)

### Language & data utilities

Everyday helpers for objects, arrays, equality, cloning and stricter types.

- **@total-typescript/ts-reset**: A 'CSS reset' for TypeScript's built-in types: `JSON.parse` and `.json()` return `unknown`, `.filter(Boolean)` narrows, and more. [GitHub](https://github.com/mattpocock/ts-reset) · [npm](https://www.npmjs.com/package/@total-typescript/ts-reset) · [docs](https://www.totaltypescript.com/ts-reset) · MIT
  - Why: One import fixes the most common unsafe or awkward typings of the standard library, and each rule can be imported on its own.
  - Note: It changes global types, so use it in applications, not in libraries you publish (its README says the same).
- **dequal**: Deep equality check, with a `dequal/lite` build for plain objects, arrays, dates and regexes. [GitHub](https://github.com/lukeed/dequal) · [npm](https://www.npmjs.com/package/dequal) · MIT
  - Why: 304 to 489 bytes gzipped depending on the build. That is all most code needs for equality, so there is no reason to pull in a bigger library.
  - Instead of: lodash.isequal, fast-deep-equal
- **es-toolkit**: Modern utility functions for arrays, objects, functions, strings and promises. [GitHub](https://github.com/toss/es-toolkit) · [npm](https://www.npmjs.com/package/es-toolkit) · [docs](https://es-toolkit.dev) · MIT
  - Why: Written in TypeScript, tree-shakable and actively maintained by Toss. Its `es-toolkit/compat` layer mirrors lodash call for call, so a migration can happen one import at a time.
  - Instead of: lodash, lodash-es, underscore
- **klona**: Deep clone with modes for JSON-only, lite and full (Map, Set, typed arrays, class instances) data. [GitHub](https://github.com/lukeed/klona) · [npm](https://www.npmjs.com/package/klona) · MIT
  - Why: 240 to 501 bytes gzipped depending on the mode, and fast. Pick the smallest mode that covers your data. For plain data, the built-in `structuredClone` is also an option.
  - Instead of: lodash.clonedeep
- **mutative**: Immutable updates written as mutations on a draft, like Immer. [GitHub](https://github.com/unadlib/mutative) · [npm](https://www.npmjs.com/package/mutative) · [docs](https://mutative.js.org) · MIT
  - Why: Same draft-based model as Immer, but faster in the project's published benchmarks: about 3.6x with the same settings across 97 workloads, and more on large arrays.
  - Instead of: immer
- **ts-pattern**: Pattern matching with exhaustiveness checking: `match(value).with(pattern, handler).exhaustive()`. [GitHub](https://github.com/gvergnaud/ts-pattern) · [npm](https://www.npmjs.com/package/ts-pattern) · MIT
  - Why: The compiler checks that every case of a union or nested shape is handled, and each branch gets the narrowed type. Reads better than nested `switch`/`if` chains.
  - Instead of: switch statements over discriminated unions

### Errors & results

Typed error handling beyond try/catch.

- **better-result**: A lightweight `Result` type with generator-based composition (`yield*`) and tagged error classes. [GitHub](https://github.com/dmmulroy/better-result) · [npm](https://www.npmjs.com/package/better-result) · [docs](https://better-result.dev) · MIT
  - Why: Multi-step workflows read as straight-line code. `TaggedError` gives discriminated error unions, and an unexpected throw becomes a `Panic` instead of widening the error type to `unknown`. Zero runtime dependencies.
  - Pairs with `@xtandard/lib`: Use `tryCatch` for one-off calls; use better-result when a function's failure modes are part of its public type.
- **neverthrow**: `Result` and `ResultAsync` types for typed, chainable error handling. [GitHub](https://github.com/supermacro/neverthrow) · [npm](https://www.npmjs.com/package/neverthrow) · MIT
  - Why: A mature, widely used Result library. `ResultAsync` keeps promise chains typed, and an ESLint plugin flags results you forgot to handle.
  - Pairs with `@xtandard/lib`: `tryCatch` turns one throwing call into a `[data, error]` tuple. Reach for neverthrow (or better-result) when errors must flow through many chained steps with their types intact.

### Async, concurrency & resilience

Bounded concurrency, queues, retries and circuit breakers.

- **better-all**: `Promise.all` over named tasks that can await each other, with full type inference. [GitHub](https://github.com/shuding/better-all) · [npm](https://www.npmjs.com/package/better-all) · MIT
  - Why: Each task starts as soon as the tasks it depends on finish, so you don't have to re-order `Promise.all` calls by hand when latencies change.
  - Note: Pre-1.0 (0.0.x).
- **cockatiel**: Resilience policies: retry with backoff, circuit breaker, timeout, bulkhead and fallback, composable with `wrap`. [GitHub](https://github.com/connor4312/cockatiel) · [npm](https://www.npmjs.com/package/cockatiel) · MIT
  - Why: Modeled on .NET's Polly. Typed, zero dependencies, and the policies compose, so one call can get retry, a circuit breaker and a timeout together.
  - Pairs with `@xtandard/lib`: Run the call through a policy and wrap it in `tryCatch` to get a `[data, error]` tuple once retries are exhausted or the breaker is open.
- **p-map**: Map over an iterable or async iterable with a concurrency limit. [GitHub](https://github.com/sindresorhus/p-map) · [npm](https://www.npmjs.com/package/p-map) · MIT
  - Why: The standard answer when `Promise.all` would start too much at once. It can stop or continue on errors, and has settled, keyed and streaming (`pMapIterable`) variants.
  - Pairs with `@xtandard/lib/pagination`: A paginator's `items()` is an async iterable, so p-map can process every row with bounded concurrency while pages are fetched lazily.
- **p-queue**: A promise queue with concurrency control, priorities and interval-based rate limiting. [GitHub](https://github.com/sindresorhus/p-queue) · [npm](https://www.npmjs.com/package/p-queue) · MIT
  - Why: Zero dependencies and battle-tested. It covers both 'at most N at a time' and 'at most N per interval' (API rate limits).
  - Pairs with `@xtandard/lib`: Push each finished task into an `AsyncChannel` and consume the results as an async iterable, or hand the channel to `toastStream` / `StreamRenderer`.

### Caching & storage

Key-value storage, caches with stale-while-revalidate, file and blob storage.

- **@epic-web/cachified**: Wraps any cache (lru-cache, Redis, SQLite, Cloudflare KV through adapters) with TTL, stale-while-revalidate, value validation and batching. [GitHub](https://github.com/epicweb-dev/cachified) · [npm](https://www.npmjs.com/package/@epic-web/cachified) · MIT
  - Why: Adds what a plain TTL cache lacks: serve stale values while refreshing in the background, validate or migrate cached values (for example with a schema), force a fresh value with fallback to the cache, and share one `getFreshValue` call between concurrent misses for the same key.
  - Instead of: cachified (the package's old name, deprecated on npm)
  - Pairs with `@xtandard/lib/unstorage`: Keep `createCache` for simple TTL caching on an unstorage driver. Switch to cachified when you need stale-while-revalidate, validation of cached values, or concurrent misses for the same key to share one fetch (within a process). `createCache` does none of these, on purpose.
- **bentocache**: A multi-tier cache for Node.js: an in-memory L1 in front of a distributed L2 (Redis, Upstash, DynamoDB, SQL databases, filesystem…), kept in sync across instances by a bus. [GitHub](https://github.com/Julien-R44/bentocache) · [npm](https://www.npmjs.com/package/bentocache) · [docs](https://bentocache.dev) · MIT
  - Why: A real caching layer rather than a storage bridge: cache stampede protection, grace periods that serve stale data when the store is down or slow, timeouts, tags, namespaces, events and OpenTelemetry instrumentation.
  - Pairs with `@xtandard/lib/unstorage`: Prefer bentocache over `createCache` when several app instances share a cache and you want a local in-memory tier kept consistent through a bus, stampede protection, grace periods or tag-based invalidation.
  - Note: Built for Node.js servers, not browsers or edge runtimes.
- **files-sdk**: One API over object and blob storage: S3 and S3-compatible services (R2, MinIO, B2…), Google Cloud Storage, Azure Blob Storage, Vercel Blob and more. [GitHub](https://github.com/haydenbleasel/files-sdk) · [npm](https://www.npmjs.com/package/files-sdk) · [docs](https://files-sdk.dev) · MIT
  - Why: Web-standard I/O, and switching providers means changing one adapter import. Each provider's SDK is an optional peer dependency, and the native client is available when you need it.
  - Note: Requires Node.js 22+ (also runs on Bun, Deno and Cloudflare Workers).
- **unstorage**: One async key-value API over many drivers: memory, filesystem, Redis, Cloudflare KV, Vercel KV, databases and more. [GitHub](https://github.com/unjs/unstorage) · [npm](https://www.npmjs.com/package/unstorage) · [docs](https://unstorage.unjs.io) · MIT
  - Why: The same code runs in browsers, Node.js and Workers, and you switch drivers by configuration. Drivers are tree-shakable and the core is tiny.
  - Pairs with `@xtandard/lib/unstorage`: `withCache` and `createCache` cache async function results, with a TTL, in any unstorage driver.
  - Note: npm's `latest` tag currently points at a v2 beta (2.0.0-beta.0). `@xtandard/lib/unstorage` targets v1, so install `unstorage@^1` with it.

### Numbers, money & units

Exact decimals and rationals, money, and byte sizes.

- **big.js**: Minimal arbitrary-precision decimal arithmetic. [GitHub](https://github.com/MikeMcl/big.js) · [npm](https://www.npmjs.com/package/big.js) · MIT
  - Why: 6 KB minified with no dependencies: the smallest of MikeMcl's three decimal libraries, for when basic arithmetic is all you need.
  - Pairs with `@xtandard/lib/big`: Exact-decimal intervals over `Big` values.
- **bignumber.js**: Arbitrary-precision decimal and non-decimal (any base) arithmetic, with formatting. [GitHub](https://github.com/MikeMcl/bignumber.js) · [npm](https://www.npmjs.com/package/bignumber.js) · MIT
  - Why: 8 KB minified and gzipped, no dependencies. Sits between big.js and decimal.js, and adds base conversion and number formatting.
  - Pairs with `@xtandard/lib/bignumber`: Exact-decimal intervals over `BigNumber` values.
- **currency.js**: Small library for currency arithmetic and formatting. [GitHub](https://github.com/scurker/currency.js) · [npm](https://www.npmjs.com/package/currency.js) · MIT
  - Why: A tiny, simple API for adding, splitting and formatting money values.
  - Note: No release since 2.0.4 (May 2021). Prefer dinero.js for new code; listed for existing users.
- **decimal.js**: An arbitrary-precision `Decimal` type with configurable precision and rounding, plus `exp`, `ln`, `log`, trigonometric and other functions. [GitHub](https://github.com/MikeMcl/decimal.js) · [npm](https://www.npmjs.com/package/decimal.js) · MIT
  - Why: The most complete of MikeMcl's three decimal libraries, for when you need more than the four basic operations. No dependencies.
  - Pairs with `@xtandard/lib/decimal`: Exact-decimal intervals over `Decimal` values.
- **dinero.js**: Immutable money objects: create, calculate, allocate, convert and format amounts in minor units with currency metadata. [GitHub](https://github.com/dinerojs/dinero.js) · [npm](https://www.npmjs.com/package/dinero.js) · [docs](https://dinerojs.com) · MIT
  - Why: Avoids floating-point money bugs, carries the currency in the type, and its functional API is tree-shakable.
  - Instead of: number arithmetic on prices, currency.js
  - Pairs with `@xtandard/lib/dinero`: `createDineroInterval` builds intervals of Dinero values: price ranges, budget bands, tiered pricing.
- **fraction.js**: Exact rational numbers (numerator / denominator), including parsing of decimals and repeating decimals. [GitHub](https://github.com/rawify/Fraction.js) · [npm](https://www.npmjs.com/package/fraction.js) · MIT
  - Why: Exact arithmetic for ratios like 1/3, which every decimal type has to round.
  - Pairs with `@xtandard/lib/fraction`: Exact-rational intervals over `Fraction` values.
- **xbytes**: Parse and format byte sizes (`4747` ↔ `'4.75 KB'`), in decimal and IEC (`KiB`) units. [GitHub](https://github.com/miraclx/xbytes) · [npm](https://www.npmjs.com/package/xbytes) · Apache-2.0
  - Why: Converts in both directions and handles both unit systems.
  - Note: No release or commit since April 2024.

### Dates, time & scheduling

Date math, the Temporal API, recurrence rules and cron.

- **@gobrand/tiempo**: date-fns-style functions for the Temporal API: time zone conversion, DST-safe date math, formatting, parsing and business days. [GitHub](https://github.com/go-brand/tiempo) · [npm](https://www.npmjs.com/package/@gobrand/tiempo) · [docs](https://tiempo.gobrand.app) · MIT
  - Why: If you know date-fns, these are the same names and argument order, on Temporal types.
  - Pairs with `@xtandard/lib/temporal`: Use tiempo for date math and formatting on Temporal values, and `@xtandard/lib/temporal` for intervals of them (`ZonedDateTimeInterval`, `PlainDateInterval`…) and `Date` ↔ Temporal conversion.
  - Note: A young project with a small community.
- **croner**: Cron scheduling and cron-expression evaluation in Node.js, Deno, Bun and browsers, with time zones. [GitHub](https://github.com/Hexagon/croner) · [npm](https://www.npmjs.com/package/croner) · MIT
  - Why: Zero dependencies. Supports seconds and year fields and the `L`, `W` and `#` modifiers, and can compute the next run times without scheduling anything.
  - Instead of: node-cron, cron
- **date-fns**: Modular date utility functions for the JavaScript `Date`. [GitHub](https://github.com/date-fns/date-fns) · [npm](https://www.npmjs.com/package/date-fns) · [docs](https://date-fns.org) · MIT
  - Why: Pure, immutable, tree-shakable functions with broad locale support. The standard choice while your code still uses `Date`.
  - Instead of: moment
- **rrule-temporal**: RFC 5545 recurrence rules (RRULE) on the Temporal API, with time zones and RFC 7529 non-Gregorian calendars. [GitHub](https://github.com/ggaabe/rrule-temporal) · [npm](https://www.npmjs.com/package/rrule-temporal) · [docs](https://ggaabe.github.io/rrule-temporal/) · MIT
  - Why: Occurrences are `Temporal.ZonedDateTime` values, so they stay correct across DST changes. Works with native Temporal or either polyfill, and can return your app's own Temporal objects.
  - Instead of: rrule (built on Date)
  - Pairs with `@xtandard/lib/temporal`: Expand a rule into occurrences, then turn each into a `ZonedDateTimeInterval` to check availability or overlaps. Pass your `Temporal` so the occurrences are instances of it.

### IDs & hashing

Unique identifiers and hash functions.

- **@noble/hashes**: Audited, dependency-free implementations of SHA-2, SHA-3, BLAKE, RIPEMD-160, HMAC, HKDF, PBKDF2, scrypt and Argon2. [GitHub](https://github.com/paulmillr/noble-hashes) · [npm](https://www.npmjs.com/package/@noble/hashes) · MIT
  - Why: Audited by an independent security firm, pure TypeScript, and runs on every platform. Use it when WebCrypto lacks the algorithm or you need synchronous hashing.
- **nanoid**: Tiny, secure, URL-friendly unique string IDs, with custom alphabets and lengths. [GitHub](https://github.com/ai/nanoid) · [npm](https://www.npmjs.com/package/nanoid) · MIT
  - Why: 117 bytes (minified and brotlied) with no dependencies, uses a cryptographically secure random source, and is faster than `crypto.randomUUID()` according to its README.
  - Instead of: uuid v4 strings when you don't need the UUID format
- **ohash**: Stable hashing, serialization, deep equality and diffing of JavaScript values. [GitHub](https://github.com/unjs/ohash) · [npm](https://www.npmjs.com/package/ohash) · MIT
  - Why: `hash(value)` gives a deterministic, short key for any serializable value: the building block for cache keys. Small and maintained by UnJS.
  - Pairs with `@xtandard/lib/unstorage`: `withCache` and `createCache` key entries by `hash(args)` from ohash unless you pass `toKey`.
- **typeid-js**: TypeIDs: type-prefixed, sortable IDs (`user_01h…`) built on UUIDv7. The official TypeScript implementation of the TypeID spec. [GitHub](https://github.com/jetify-com/typeid-js) · [npm](https://www.npmjs.com/package/typeid-js) · Apache-2.0
  - Why: TypeID is a cross-language spec, the prefix is part of the type (`TypeID<"user">`), and the suffix converts to and from a UUID, so IDs fit `uuid` columns.
  - Pairs with `@xtandard/lib/ulid`: `@xtandard/lib/ulid` makes prefixed ULIDs as plain strings, with no spec behind them. Prefer typeid-js when IDs cross languages, must be stored as UUIDs, or you want the prefix checked by the compiler.

### Parsing & formats

Versions, IP addresses, JSON supersets, URL-friendly encodings and HTML.

- **@effective/rison**: Rison: a compact, URL-friendly encoding of JSON, TypeScript-first and ESM-only, with optional compression helpers. [GitHub](https://github.com/sebastian-software/effective-rison) · [npm](https://www.npmjs.com/package/@effective/rison) · MIT
  - Why: Nested filter, sort and column state stays readable and short in a URL, with minimal escaping.
  - Pairs with `@xtandard/lib/tanstack/rison`: `risonCodec` plugs Rison into `parseAsCodec` for URL query state.
  - Note: A small project with few users.
- **cheerio**: Parse and manipulate HTML and XML with a jQuery-like API, without a browser. [GitHub](https://github.com/cheeriojs/cheerio) · [npm](https://www.npmjs.com/package/cheerio) · [docs](https://cheerio.js.org) · MIT
  - Why: Familiar selectors and traversal on top of parse5 (or htmlparser2). The standard for scraping and server-side HTML transforms.
- **destr**: A faster, safer `JSON.parse`: returns `unknown`, passes non-JSON strings through instead of throwing, and guards against prototype pollution. [GitHub](https://github.com/unjs/destr) · [npm](https://www.npmjs.com/package/destr) · MIT
  - Why: Convenient for parsing values of uncertain shape (query params, storage, env); `safeDestr` throws when you want strict parsing.
- **ipaddr.js**: Parse, validate and classify IPv4 and IPv6 addresses and CIDR ranges, including IPv4-mapped IPv6. [GitHub](https://github.com/whitequark/ipaddr.js) · [npm](https://www.npmjs.com/package/ipaddr.js) · MIT
  - Why: Small, no dependencies, and long established.
  - Pairs with `@xtandard/lib/ip`: IPv4/IPv6 address and CIDR intervals: containment, overlap and merging of address ranges.
- **semver**: Parse, compare, increment and match semantic versions and ranges. [GitHub](https://github.com/npm/node-semver) · [npm](https://www.npmjs.com/package/semver) · ISC
  - Why: The semver parser npm itself uses, so ranges behave exactly as they do in `package.json`.
  - Pairs with `@xtandard/lib/semver`: Semantic-version range intervals: intersect, merge and compare version ranges as `Interval`s.
- **superjson**: Serialize `Date`, `Map`, `Set`, `BigInt`, `RegExp`, `undefined` and more through JSON, and get them back. [GitHub](https://github.com/ravionhq/superjson) · [npm](https://www.npmjs.com/package/superjson) · MIT
  - Why: Keeps rich types across a JSON boundary (API responses, server-to-client props) with a negligible runtime footprint.

### HTTP clients & URLs

fetch wrappers and URL helpers.

- **ky**: A tiny `fetch`-based HTTP client with retries, timeouts, hooks and JSON shortcuts. [GitHub](https://github.com/sindresorhus/ky) · [npm](https://www.npmjs.com/package/ky) · MIT
  - Why: No dependencies and stays close to `fetch`, while fixing its rough edges (non-2xx responses throw, retries on failure).
  - Instead of: axios
- **ofetch**: A better `fetch`: automatic JSON parsing, typed `FetchError` with the parsed body, retries, timeouts and interceptors. [GitHub](https://github.com/unjs/ofetch) · [npm](https://www.npmjs.com/package/ofetch) · MIT
  - Why: Works the same in Node.js, browsers and Workers. Maintained by UnJS.
- **ufo**: URL utilities: parse, join and normalize URLs, read and write query params, trailing slashes. [GitHub](https://github.com/unjs/ufo) · [npm](https://www.npmjs.com/package/ufo) · MIT
  - Why: Consistent helpers for the cases the `URL` constructor doesn't cover, such as relative URLs and joining paths.

### Servers & APIs

Web frameworks, middleware and GraphQL.

- **elysia**: A Bun-first web framework with end-to-end type safety. [GitHub](https://github.com/elysiajs/elysia) · [npm](https://www.npmjs.com/package/elysia) · [docs](https://elysiajs.com) · MIT
  - Why: Route schemas validate requests and flow into the typed Eden client.
- **gql.tada**: GraphQL documents typed on the fly from your schema, with no code generation step. [GitHub](https://github.com/0no-co/gql.tada) · [npm](https://www.npmjs.com/package/gql.tada) · [docs](https://gql-tada.0no.co) · MIT
  - Why: Together with GraphQLSP you get types and editor diagnostics as you write queries.
  - Instead of: graphql-codegen for client documents
- **graphql-yoga**: A batteries-included, spec-compliant GraphQL server that runs on any JavaScript runtime. [GitHub](https://github.com/graphql-hive/graphql-yoga) · [npm](https://www.npmjs.com/package/graphql-yoga) · [docs](https://the-guild.dev/graphql/yoga-server) · MIT
  - Why: Subscriptions built in, every envelop plugin works, and it's maintained by The Guild.
  - Instead of: apollo-server
- **hono**: A small web framework on Web Standards for Cloudflare Workers, Deno, Bun, Node.js, AWS Lambda and more. [GitHub](https://github.com/honojs/hono) · [npm](https://www.npmjs.com/package/hono) · [docs](https://hono.dev) · MIT
  - Why: Zero dependencies (the `hono/tiny` preset is under 12 kB), the same code on every runtime, and many built-in middlewares.
  - Pairs with `@xtandard/lib/filters`: List endpoints: validate the incoming filter request with the ready-made schemas, render it with a database adapter, and serve pages with `@xtandard/lib/pagination`.
- **hono-idempotency**: Stripe-style `Idempotency-Key` middleware for Hono, following the IETF idempotency-key header draft. [GitHub](https://github.com/paveg/hono-idempotency) · [npm](https://www.npmjs.com/package/hono-idempotency) · MIT
  - Why: Request fingerprinting rejects a reused key with a different payload, concurrent duplicates are locked out, and replays return the stored response. Errors are RFC 9457 problem details. Stores: memory, Redis, Cloudflare KV and D1, Durable Objects.
  - Note: Young and pre-1.0 (0.9.x), with a small community.
- **Pothos** (`@pothos/core`): A code-first, plugin-based GraphQL schema builder. [GitHub](https://github.com/hayes/pothos) · [npm](https://www.npmjs.com/package/@pothos/core) · [docs](https://pothos-graphql.dev) · ISC
  - Why: Types are inferred from your code, with no code generation and no decorators, and `graphql` is its only dependency.

### Databases & ORMs

Query builders, ORMs, embedded databases and their helpers.

- **dexie**: A promise-based IndexedDB wrapper with schema versioning, rich queries and live queries. [GitHub](https://github.com/dexie/Dexie.js) · [npm](https://www.npmjs.com/package/dexie) · [docs](https://dexie.org) · Apache-2.0
  - Why: Works around bugs in browsers' IndexedDB implementations, and `useLiveQuery` (dexie-react-hooks) re-renders when the data changes.
  - Note: Sync, auth and collaboration come from Dexie Cloud, a separate commercial service.
- **drizzle-audit**: Audit logging for Drizzle ORM: tracks changes and custom actions, with pluggable storage, automatic context propagation and field-level transforms. [GitHub](https://github.com/xantiagoma/drizzle-audit) · [npm](https://www.npmjs.com/package/drizzle-audit) · MIT
  - Why: Wrap the database to get CRUD audit logs, then add context, redaction and external storage as you need them. Framework middleware is included.
  - Note: Pre-1.0 (0.1.x).
- **drizzle-cursor**: Cursor-based pagination for Drizzle ORM: any number of cursor columns, custom serialization, SQL expressions, query builder and relational queries. [GitHub](https://github.com/xantiagoma/drizzle-cursor) · [npm](https://www.npmjs.com/package/drizzle-cursor) · MIT
  - Why: A focused, single-purpose library for keyset pagination on Drizzle.
  - Pairs with `@xtandard/lib/pagination/drizzle`: Both do keyset pagination on Drizzle. `@xtandard/lib/pagination` adds offset and page modes, the same API across ORMs, and frontend helpers.
- **drizzle-orm**: A type-safe TypeScript ORM and SQL query builder for Postgres, MySQL, SQLite and more, with migrations through drizzle-kit. [GitHub](https://github.com/drizzle-team/drizzle-orm) · [npm](https://www.npmjs.com/package/drizzle-orm) · [docs](https://orm.drizzle.team) · Apache-2.0
  - Why: A SQL-shaped API with no runtime code generation, and it runs in every major runtime, serverless and edge included.
  - Pairs with `@xtandard/lib/filters/drizzle`: Render a filter request to a Drizzle `WHERE` (or an RQB v2 `where` object with `/filters/drizzle-rqb`).
  - Pairs with `@xtandard/lib/pagination/drizzle`: Keyset (cursor) and offset pagination over Drizzle queries.
- **kysely**: A type-safe, autocompletion-friendly SQL query builder. [GitHub](https://github.com/kysely-org/kysely) · [npm](https://www.npmjs.com/package/kysely) · [docs](https://kysely.dev) · MIT
  - Why: Every query is typed from your database interface, and it runs in Node.js, Deno, Bun, Cloudflare Workers and browsers.
  - Pairs with `@xtandard/lib/filters/kysely`: Render a filter request to a Kysely boolean expression.
  - Pairs with `@xtandard/lib/pagination/kysely`: Keyset (cursor) and offset pagination over Kysely queries.
- **PGlite** (`@electric-sql/pglite`): Postgres compiled to WASM: in-memory, or persisted to the filesystem (Node.js, Bun, Deno) or IndexedDB (browsers). [GitHub](https://github.com/electric-sql/pglite) · [npm](https://www.npmjs.com/package/@electric-sql/pglite) · [docs](https://pglite.dev) · Apache-2.0
  - Why: Real Postgres without a server: 3 MB gzipped, with extensions such as pgvector and PostGIS. Good for tests and local-first apps.
  - Pairs with `@xtandard/lib/filters/drizzle`: Run your filter and pagination queries against real Postgres in-process, for example through Drizzle's PGlite driver in tests.

### Auth & permissions

Authentication and authorization.

- **arctic**: OAuth 2.0 authorization-code clients for popular providers. [GitHub](https://github.com/pilcrowonpaper/arctic) · [npm](https://www.npmjs.com/package/arctic) · [docs](https://arcticjs.dev) · MIT
  - Why: Light, typed and runtime-agnostic, built on `fetch`.
  - Note: Deprecated in July 2026: npm marks it unsupported, and the repository's README links the deprecation announcement and example code to replace it. Pending removal from this list.
- **better-auth**: A framework-agnostic authentication (and authorization) framework for TypeScript: email and password, social sign-in, sessions, and plugins for 2FA, multi-tenancy and more. [GitHub](https://github.com/better-auth/better-auth) · [npm](https://www.npmjs.com/package/better-auth) · [docs](https://www.better-auth.com) · MIT
  - Why: Users and sessions live in your own database, and its plugin ecosystem covers what often needs a hosted auth service.
- **CASL** (`@casl/ability`): Isomorphic authorization: define what a user can do with which resources, and check it in the API and the UI. [GitHub](https://github.com/stalniy/casl) · [npm](https://www.npmjs.com/package/@casl/ability) · [docs](https://casl.js.org) · MIT
  - Why: The core is about 6 KB minified and gzipped, rules can be serialized and shared with the frontend, and there are integrations for React, Vue, Angular, Mongoose and Prisma.
- **oslo**: Auth utilities: hashing, JWT, OTP (HOTP/TOTP), cookies, encoding, password hashing. [GitHub](https://github.com/pilcrowonpaper/oslo) · [npm](https://www.npmjs.com/package/oslo) · MIT
  - Why: Runtime-agnostic, typed primitives for building auth yourself.
  - Note: Deprecated and archived. Its README points to the Oslo project packages (`@oslojs/*`), which npm has also marked unsupported. Pending removal from this list.
- **permix**: Type-safe permissions from one typed schema, framework-agnostic, on the client and the server. [GitHub](https://github.com/letstri/permix) · [npm](https://www.npmjs.com/package/permix) · [docs](https://permix.letstri.dev) · MIT
  - Why: Lightweight, and a permission that is misspelled or missing is a TypeScript error. Integrations exist for UI frameworks, SSR hydration and server middleware.

### Payments

Billing and payment APIs.

- **PayKit** (`paykitjs`): An embedded Stripe billing framework: plans and features in code, entitlements, usage metering, and webhooks handled for you. [GitHub](https://github.com/getpaykit/paykit) · [npm](https://www.npmjs.com/package/paykitjs) · [docs](https://paykit.sh) · MIT
  - Why: Billing state lives in your database instead of being stitched together from raw Stripe APIs and webhooks.
  - Note: Pre-1.0 (0.x).
- **stripe**: Stripe's official API client for Node.js and other server runtimes. [GitHub](https://github.com/stripe/stripe-node) · [npm](https://www.npmjs.com/package/stripe) · [docs](https://docs.stripe.com/api?lang=node) · MIT
  - Why: Typed and maintained by Stripe.

### Background jobs & workflows

Durable functions, queues and workflow engines.

- **inngest**: Durable functions, events and queues: step-based functions that retry and resume, served from your app over HTTP. [GitHub](https://github.com/inngest/inngest-js) · [npm](https://www.npmjs.com/package/inngest) · [docs](https://www.inngest.com/docs) · Apache-2.0
  - Why: No queue infrastructure to run, and it works with most frameworks and serverless platforms.
  - Note: Functions are orchestrated by the Inngest platform.
- **Temporal** (`@temporalio/client`): Durable execution: workflows written as code that survive crashes and can run for days or years, with activities, retries, timers and signals. [GitHub](https://github.com/temporalio/sdk-typescript) · [npm](https://www.npmjs.com/package/@temporalio/client) · [docs](https://docs.temporal.io) · MIT
  - Why: A proven, distributed orchestration engine with an official TypeScript SDK.
  - Note: Needs a Temporal server (self-hosted or Temporal Cloud), and the project strongly recommends running workers on Node.js.
- **Trigger.dev** (`@trigger.dev/sdk`): Long-running background tasks with retries, queues, concurrency control and observability. [GitHub](https://github.com/triggerdotdev/trigger.dev) · [npm](https://www.npmjs.com/package/@trigger.dev/sdk) · [docs](https://trigger.dev/docs) · MIT
  - Why: An open-source platform: use the managed cloud or self-host it (documented at trigger.dev/docs/self-hosting).
- **Workflow SDK** (`workflow`): Makes TypeScript functions durable: persisted progress, retried steps, suspension without using compute, built-in observability. [GitHub](https://github.com/vercel/workflow) · [npm](https://www.npmjs.com/package/workflow) · [docs](https://workflow-sdk.dev) · Apache-2.0
  - Why: Durable workflows as ordinary async functions, with framework integrations such as Next.js.
  - Note: Managed on Vercel; to self-host, use the Postgres backend or a custom 'World'.

### AI

LLM toolkits, AI UI and sandboxes.

- **@vercel/sandbox**: SDK for Vercel Sandbox: run arbitrary code in isolated Linux microVMs, with the filesystem snapshotted between sessions. [GitHub](https://github.com/vercel/sandbox) · [npm](https://www.npmjs.com/package/@vercel/sandbox) · [docs](https://vercel.com/docs/vercel-sandbox) · Apache-2.0
  - Why: A simple way to run untrusted or AI-generated code safely.
  - Note: A Vercel service: needs a Vercel account and is billed by usage.
- **AI Elements** (`ai-elements`): React components for AI interfaces (conversations, messages, code blocks, reasoning…), installed into your project through a shadcn/ui registry. [GitHub](https://github.com/vercel/ai-elements) · [npm](https://www.npmjs.com/package/ai-elements) · [docs](https://elements.ai-sdk.dev) · Apache-2.0
  - Why: Ready-made AI chat UI built on shadcn/ui and the AI SDK.
  - Note: Being deprecated at the end of November 2026 in favour of AI Elements in shadcn/ui; new projects should use that. Pending replacement in this list.
- **AI SDK** (`ai`): A provider-agnostic toolkit for LLM apps and agents: text and structured generation, tool calling, streaming, and UI hooks for React, Svelte, Vue and Angular. [GitHub](https://github.com/vercel/ai) · [npm](https://www.npmjs.com/package/ai) · [docs](https://ai-sdk.dev) · Apache-2.0
  - Why: One API across OpenAI, Anthropic, Google and the other providers, with first-class streaming.
- **streamdown**: A drop-in `react-markdown` replacement for streamed AI output. [GitHub](https://github.com/vercel/streamdown) · [npm](https://www.npmjs.com/package/streamdown) · [docs](https://streamdown.ai) · Apache-2.0
  - Why: Renders incomplete Markdown gracefully while it streams, with GFM, KaTeX math, Mermaid diagrams, Shiki highlighting and hardened (safe) rendering.
  - Instead of: react-markdown for streamed content

### Email, chat & notifications

Email templates, multi-channel notifications and chat bots.

- **Better Notify** (`@betternotify/core`): End-to-end typed notifications for Node.js and Bun: email, SMS, push, Slack, Discord, Telegram and more from one catalog. [GitHub](https://github.com/better-notify/better-notify) · [npm](https://www.npmjs.com/package/@betternotify/core) · [docs](https://better-notify.com) · MIT
  - Why: One catalog type drives the client, the queue worker and the webhook router, transports can be swapped, and middleware (rate limits, idempotency, tracing) is built in.
  - Note: 1.0 is in beta (1.0.0-beta.x).
- **Chat SDK** (`chat`): Build chat bots and AI agents once for Slack, Microsoft Teams, Google Chat, Discord, WhatsApp and more. [GitHub](https://github.com/vercel/chat) · [npm](https://www.npmjs.com/package/chat) · [docs](https://chat-sdk.dev) · MIT
  - Why: One TypeScript API for events, messages and cards across platforms.
- **React Email** (`react-email`): Unstyled React components and a preview server for building emails. [GitHub](https://github.com/resend/react-email) · [npm](https://www.npmjs.com/package/react-email) · [docs](https://react.email) · MIT
  - Why: Write emails in React and TypeScript, and let it handle the inconsistencies between Gmail, Outlook and other clients, including dark mode.
  - Note: The separate `@react-email/components` package is deprecated on npm; follow the current install docs.

### Search

Client-side and in-memory search.

- **fuse.js**: Lightweight fuzzy search over arrays of strings or objects, with weighted keys and extended and logical queries. [GitHub](https://github.com/krisk/Fuse) · [npm](https://www.npmjs.com/package/fuse.js) · [docs](https://www.fusejs.io) · Apache-2.0
  - Why: No backend and no index server: about 8.6 kB for the full build. Good for command palettes and small to medium lists.
- **Orama** (`@orama/orama`): An in-memory search engine with full-text, vector and hybrid search, for browsers, servers and edge runtimes. [GitHub](https://github.com/oramasearch/orama) · [npm](https://www.npmjs.com/package/@orama/orama) · [docs](https://docs.orama.com) · Apache-2.0
  - Why: Typed schemas, filters, facets and vector search in one package that runs anywhere.

### React: state, data & routing

Server state, client state, URL state, routing, forms and tables.

- **@tanstack/react-form**: Headless, type-safe form state and validation for React. [GitHub](https://github.com/TanStack/form) · [npm](https://www.npmjs.com/package/@tanstack/react-form) · [docs](https://tanstack.com/form) · MIT
  - Why: Deeply typed field paths, sync and async validation, and fine-grained re-renders.
- **@tanstack/react-query**: Server-state management for React: caching, request deduplication, background refetching, mutations and infinite queries. [GitHub](https://github.com/TanStack/query) · [npm](https://www.npmjs.com/package/@tanstack/react-query) · [docs](https://tanstack.com/query) · MIT
  - Why: The de facto standard for fetching and caching server data in React.
  - Pairs with `@xtandard/lib/react`: `useStream` and `StreamRenderer` run streamed sources (async iterables, `AsyncChannel`) through React Query.
- **@tanstack/react-router**: A fully type-safe router for React: typed path and search params, loaders with caching, file-based or code-based routes. [GitHub](https://github.com/TanStack/router) · [npm](https://www.npmjs.com/package/@tanstack/react-router) · [docs](https://tanstack.com/router) · MIT
  - Why: Search params are first-class, validated and typed state, which makes it a good fit for URL-driven UIs.
  - Pairs with `@xtandard/lib/tanstack`: nuqs-style URL query state (`useQueryState`, parsers, codecs) on top of TanStack Router.
- **@tanstack/react-table**: Headless table and datagrid logic: sorting, filtering, grouping, pagination, column visibility and more. [GitHub](https://github.com/TanStack/table) · [npm](https://www.npmjs.com/package/@tanstack/react-table) · [docs](https://tanstack.com/table) · MIT
  - Why: You keep full control of the markup and styling, and it scales from simple tables to complex datagrids.
  - Pairs with `@xtandard/lib/filters`: For server-side tables, express column filters and sorting as a filter request and sort spec, and serve pages with `@xtandard/lib/pagination`.
- **@tanstack/react-virtual**: Headless virtualization for long lists, grids and tables. [GitHub](https://github.com/TanStack/virtual) · [npm](https://www.npmjs.com/package/@tanstack/react-virtual) · [docs](https://tanstack.com/virtual) · MIT
  - Why: Renders only what is visible, with dynamic item sizes, and leaves the markup to you.
- **jotai**: Primitive, atomic client state for React. [GitHub](https://github.com/pmndrs/jotai) · [npm](https://www.npmjs.com/package/jotai) · [docs](https://jotai.org) · MIT
  - Why: State is built from small atoms that compose, so components re-render only for what they read, without a global store or boilerplate.
- **nuqs**: Type-safe URL search-param state for React: like `useState`, but stored in the query string. [GitHub](https://github.com/47ng/nuqs) · [npm](https://www.npmjs.com/package/nuqs) · [docs](https://nuqs.dev) · MIT
  - Why: Adapters for Next.js (app and pages routers), plain React, Remix and React Router, with parsers and serializers.
  - Pairs with `@xtandard/lib/tanstack`: `@xtandard/lib/tanstack` is a nuqs-style API built on TanStack Router's own search params (with server parsers, a testing adapter, and Temporal and Rison codecs). nuqs's TanStack Router adapter is experimental, so use nuqs on the other routers.
- **react-router**: Routing for React, as a library (declarative or data mode) or as a full-stack framework. [GitHub](https://github.com/remix-run/react-router) · [npm](https://www.npmjs.com/package/react-router) · [docs](https://reactrouter.com) · MIT
  - Why: The most widely used React router, and the successor of Remix as a framework.

### React: UI components

Headless and lightly styled components.

- **cmdk**: A fast, unstyled command menu (⌘K) for React that also works as an accessible combobox. [GitHub](https://github.com/dip/cmdk) · [npm](https://www.npmjs.com/package/cmdk) · MIT
  - Why: It filters and sorts items automatically, and its composable API lets you wrap items in your own components.
- **dnd kit** (`@dnd-kit/react`): A drag-and-drop toolkit: sortable lists, a framework-agnostic core and a React adapter. [GitHub](https://github.com/clauderic/dnd-kit) · [npm](https://www.npmjs.com/package/@dnd-kit/react) · [docs](https://dndkit.com) · MIT
  - Why: Accessible by default (keyboard support, ARIA attributes, screen reader announcements), performant and extensible.
  - Note: The new `@dnd-kit/react` is pre-1.0 (0.x); the long-standing `@dnd-kit/core` v6 has had no release since December 2024.
- **embla-carousel**: A lightweight carousel with fluid motion and precise swiping, with React, Vue, Svelte and Solid wrappers. [GitHub](https://github.com/davidjerleke/embla-carousel) · [npm](https://www.npmjs.com/package/embla-carousel) · [docs](https://www.embla-carousel.com) · MIT
  - Why: Dependency-free, library-agnostic, and extensible through plugins.
- **liveline**: Real-time animated charts for React: line, multi-series and candlestick. [GitHub](https://github.com/benjitaylor/liveline) · [npm](https://www.npmjs.com/package/liveline) · MIT
  - Why: Canvas-rendered at 60 fps with smooth interpolation between updates, and no CSS imports.
  - Note: Pre-1.0 (0.0.x).
- **lucide-react**: Lucide's consistent SVG icon set as tree-shakable React components. [GitHub](https://github.com/lucide-icons/lucide) · [npm](https://www.npmjs.com/package/lucide-react) · [docs](https://lucide.dev) · ISC
  - Why: A large, consistent icon set where you only ship the icons you import.
- **masonic**: A virtualized masonry grid for React. [GitHub](https://github.com/jaredLunde/masonic) · [npm](https://www.npmjs.com/package/masonic) · MIT
  - Why: Renders tens of thousands of cells without lag, and exposes its building blocks (hooks) for custom layouts.
- **next-themes**: Theme switching (dark mode, system preference) for React apps. [GitHub](https://github.com/pacocoursey/next-themes) · [npm](https://www.npmjs.com/package/next-themes) · MIT
  - Why: Two lines of setup, and no flash of the wrong theme on load.
- **React Flow** (`@xyflow/react`): Node-based editors and interactive diagrams for React. [GitHub](https://github.com/xyflow/xyflow) · [npm](https://www.npmjs.com/package/@xyflow/react) · [docs](https://reactflow.dev) · MIT
  - Why: Highly customizable nodes and edges, with built-in zoom, pan, selection, minimap and controls.
  - Instead of: reactflow (the package name before v12)
- **react-error-boundary**: A reusable error boundary component and hooks for React. [GitHub](https://github.com/bvaughn/react-error-boundary) · [npm](https://www.npmjs.com/package/react-error-boundary) · MIT
  - Why: Fallback UI, reset keys and `useErrorBoundary`, without writing a class component.
- **react-hotkeys-hook**: A React hook for keyboard shortcuts. [GitHub](https://github.com/JohannesKlauss/react-hotkeys-hook) · [npm](https://www.npmjs.com/package/react-hotkeys-hook) · MIT
  - Why: Declarative shortcuts with modifier combinations and scopes, bound to a component's lifecycle.
- **react-lzy-img**: A small lazy-loading image component for React with responsive images, BlurHash or LQIP placeholders and retries. [GitHub](https://github.com/garrettsiegel/react-lzy-img) · [npm](https://www.npmjs.com/package/react-lzy-img) · [docs](https://www.reactlzyimg.online) · MIT
  - Why: About 1.4 KB gzipped, with shared IntersectionObservers for long lists.
  - Note: A small project with a single maintainer.
- **sonner**: An opinionated toast component for React. [GitHub](https://github.com/emilkowalski/sonner) · [npm](https://www.npmjs.com/package/sonner) · [docs](https://sonner.emilkowal.ski) · MIT
  - Why: Good defaults and animations, promise toasts, and a one-line API (`toast(...)`) callable from anywhere.
  - Pairs with `@xtandard/lib/sonner`: `toastStream` shows a stream's progress in one toast: loading, each item, then success or error.
- **Tiptap** (`@tiptap/core`): A headless rich-text editor framework built on ProseMirror, with React and Vue bindings. [GitHub](https://github.com/ueberdosis/tiptap) · [npm](https://www.npmjs.com/package/@tiptap/core) · [docs](https://tiptap.dev) · MIT
  - Why: Full control over the UI, and a large set of extensions.
  - Note: The editor is open source; the Pro extensions need a paid subscription.
- **vaul**: A drawer component for React. [GitHub](https://github.com/emilkowalski/vaul) · [npm](https://www.npmjs.com/package/vaul) · [docs](https://vaul.emilkowal.ski) · MIT
  - Why: Native-feeling mobile drawers with drag to dismiss and snap points.
  - Note: Unmaintained: its README says so, and the last release was in December 2024. Pending removal from this list.

### Styling & animation

Class names, variants, colors and motion.

- **auto-animate** (`@formkit/auto-animate`): Zero-config animations when elements are added, removed or moved, for React, Vue, Solid or any JavaScript app. [GitHub](https://github.com/formkit/auto-animate) · [npm](https://www.npmjs.com/package/@formkit/auto-animate) · [docs](https://auto-animate.formkit.com) · MIT
  - Why: One line of code (a ref or a function call) animates list changes.
- **chroma-js**: Color conversions, manipulation and color scales (including Lab and LCH interpolation). [GitHub](https://github.com/gka/chroma.js) · [npm](https://www.npmjs.com/package/chroma-js) · [docs](https://gka.github.io/chroma.js/) · (BSD-3-Clause AND Apache-2.0)
  - Why: Zero dependencies, with a complete set of color spaces and scales for data visualization.
- **class-variance-authority**: Typed variant APIs for class names: `cva(base, { variants, defaultVariants })`. [GitHub](https://github.com/joe-bell/cva) · [npm](https://www.npmjs.com/package/class-variance-authority) · [docs](https://cva.style) · Apache-2.0
  - Why: Component variants with typed props, the pattern shadcn/ui uses.
- **clsx**: Build `className` strings conditionally. [GitHub](https://github.com/lukeed/clsx) · [npm](https://www.npmjs.com/package/clsx) · MIT
  - Why: 239 bytes gzipped, and a faster, smaller drop-in replacement for `classnames`.
  - Instead of: classnames
- **motion**: An animation library for React and JavaScript (formerly Framer Motion): gestures, layout animations, springs, scroll. [GitHub](https://github.com/motiondivision/motion) · [npm](https://www.npmjs.com/package/motion) · [docs](https://motion.dev) · MIT
  - Why: Production-ready, tree-shakable, and the most complete declarative animation API for React.
  - Instead of: framer-motion
- **tailwind-merge**: Merge Tailwind CSS class strings without style conflicts (the last `p-*` wins). [GitHub](https://github.com/dcastil/tailwind-merge) · [npm](https://www.npmjs.com/package/tailwind-merge) · MIT
  - Why: Lets components accept a `className` that overrides their defaults correctly.

### Documents, media & devices

Images, spreadsheets, barcodes, printers, uploads and haptics.

- **etiket**: A zero-dependency barcode and QR code generator: 40+ formats, styled QR codes, SVG and PNG output. [GitHub](https://github.com/productdevbook/etiket) · [npm](https://www.npmjs.com/package/etiket) · MIT
  - Why: Each format is verified against an independent decoder or encoder, it is tree-shakable, and it runs everywhere.
- **hucre**: A zero-dependency spreadsheet engine: read and write XLSX, CSV and ODS, with schema validation and streaming. [GitHub](https://github.com/productdevbook/hucre) · [npm](https://www.npmjs.com/package/hucre) · MIT
  - Why: Pure TypeScript that runs everywhere, edge runtimes included, and much smaller than the usual spreadsheet libraries (the CSV-only import is about 2 KB gzipped).
  - Instead of: xlsx (SheetJS), exceljs
- **portakal**: One API for thermal printer languages: ESC/POS, ZPL, TSC, EPL, CPCL and more, plus parsers and validation. [GitHub](https://github.com/productdevbook/portakal) · [npm](https://www.npmjs.com/package/portakal) · MIT
  - Why: Pure TypeScript with zero dependencies; only the printer languages you import end up in the bundle.
  - Note: Pre-1.0 (0.x); the project asks for testing on real printers.
- **satori**: Convert HTML and CSS (written as JSX) to SVG, for example for Open Graph images. [GitHub](https://github.com/vercel/satori) · [npm](https://www.npmjs.com/package/satori) · MPL-2.0
  - Why: Runs in browsers, Node.js and Web Workers, with no headless browser needed.
  - Note: MPL-2.0 is a weak (file-level) copyleft: fine as a dependency, but changes to satori's own files must stay open source.
- **tactus**: Haptic feedback for web apps: `triggerHaptic()` gives Safari's native tick on iOS and uses the Vibration API on Android. [GitHub](https://github.com/aadeexyz/tactus) · [npm](https://www.npmjs.com/package/tactus) · [docs](https://tactus.aadee.xyz) · MIT
  - Why: A one-function API for something the web platform doesn't offer directly on iOS.
  - Note: 0.0.x, with no release since June 2025; desktop browsers are not supported.
- **thumbhash**: A very compact image placeholder hash, to show while the real image loads. [GitHub](https://github.com/evanw/thumbhash) · [npm](https://www.npmjs.com/package/thumbhash) · [docs](https://evanw.github.io/thumbhash/) · MIT
  - Why: Compared with BlurHash, it encodes more detail in the same space, includes the aspect ratio, and supports alpha.
  - Instead of: blurhash
- **Uppy** (`@uppy/core`): A modular file-upload UI and engine: dashboard, webcam and remote sources, resumable (tus) and S3 uploads. [GitHub](https://github.com/transloadit/uppy) · [npm](https://www.npmjs.com/package/@uppy/core) · [docs](https://uppy.io) · MIT
  - Why: Pluggable and framework-agnostic, with React components and headless options.

### CLI, logging & tooling

Command-line apps, processes, logging, environment and code health.

- **citty**: An elegant CLI builder: typed arguments, nested and lazily loaded sub-commands, generated usage. [GitHub](https://github.com/unjs/citty) · [npm](https://www.npmjs.com/package/citty) · MIT
  - Why: Zero dependencies, built on Node's `util.parseArgs`.
  - Instead of: commander, yargs
- **Clack** (`@clack/prompts`): Pre-styled, interactive command-line prompts: text, select, confirm, spinners and grouped flows. [GitHub](https://github.com/bombshell-dev/clack) · [npm](https://www.npmjs.com/package/@clack/prompts) · MIT
  - Why: Good-looking prompts with almost no code.
  - Instead of: inquirer, prompts
- **consola**: A console logger for Node.js and browsers with log levels, pluggable reporters and interactive prompts. [GitHub](https://github.com/unjs/consola) · [npm](https://www.npmjs.com/package/consola) · MIT
  - Why: Nice output out of the box; a smaller core build drops the fancy reporter.
- **dotenv**: Loads environment variables from a `.env` file into `process.env`. [GitHub](https://github.com/motdotla/dotenv) · [npm](https://www.npmjs.com/package/dotenv) · BSD-2-Clause
  - Why: The long-standing standard, with zero dependencies.
  - Note: Node.js 20.6+ (`--env-file`), Bun and Deno can read `.env` files natively, so you may not need it.
- **evlog**: A TypeScript logger built around wide events: one structured event per operation with all its context, plus structured errors. [GitHub](https://github.com/evloghq/evlog) · [npm](https://www.npmjs.com/package/evlog) · [docs](https://evlog.dev) · MIT
  - Why: One drain pipeline for scripts, libraries, jobs, edge and HTTP handlers, so logs become queryable events.
- **execa**: Run commands from scripts and apps: promise and template-string APIs, piping, and better Windows support. [GitHub](https://github.com/sindresorhus/execa) · [npm](https://www.npmjs.com/package/execa) · MIT
  - Why: Built on `child_process` but designed for programmatic use, with good errors and graceful termination.
  - Instead of: child_process, shelljs
- **knip**: Finds and fixes unused files, dependencies and exports in JavaScript and TypeScript projects. [GitHub](https://github.com/webpro-nl/knip) · [npm](https://www.npmjs.com/package/knip) · [docs](https://knip.dev) · ISC
  - Why: Understands many frameworks and tools through plugins, and works in monorepos.
- **std-env**: Detects the JavaScript runtime (Node.js, Bun, Deno, workerd…), CI provider, AI coding agents and environment flags. [GitHub](https://github.com/unjs/std-env) · [npm](https://www.npmjs.com/package/std-env) · MIT
  - Why: Runtime-agnostic and follows the WinterCG runtime keys proposal.
- **unctx**: Composition-API-style context (`ctx.use()`) for plain JavaScript libraries. [GitHub](https://github.com/unjs/unctx) · [npm](https://www.npmjs.com/package/unctx) · MIT
  - Why: Makes 'call `useX()` anywhere inside a request' work, with optional `AsyncLocalStorage` to keep the context across `await`.

<!-- recs:end -->

## The xtandard ecosystem

`@xtandard/lib` is one of a family of open-source, MIT-licensed projects that share the xtandard
name. They are independent of each other: use any of them on its own.

| Project                            | What it is                                                                                                                                                                                                      | Links                                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@xtandard/lib`** (this package) | Lightweight, type-safe TypeScript utilities with a zero-dependency core                                                                                                                                         | [Docs](https://me.xantiagoma.com/xtandard/) · [npm](https://www.npmjs.com/package/@xtandard/lib)                                                                           |
| **`@xtandard/flags`**              | A self-hosted, embeddable, OpenFeature-compatible feature-flag control plane with pluggable storage                                                                                                             | [Docs](https://me.xantiagoma.com/xtandard-flags/) · [GitHub](https://github.com/xantiagoma/xtandard-flags) · [npm](https://www.npmjs.com/package/@xtandard/flags)          |
| **`@xtandard/webhooks`**           | A self-hosted, embeddable, Standard Webhooks-compliant outbound-webhooks control plane: a Svix alternative as a library                                                                                         | [Docs](https://me.xantiagoma.com/xtandard-webhooks/) · [GitHub](https://github.com/xantiagoma/xtandard-webhooks) · [npm](https://www.npmjs.com/package/@xtandard/webhooks) |
| **`@xtandard/xyte`**               | A Zyte API-compatible `/v1/extract` client and server that runs on any proxy provider, or none                                                                                                                  | [Docs](https://me.xantiagoma.com/xyte/) · [GitHub](https://github.com/xantiagoma/xyte) · [npm](https://www.npmjs.com/package/@xtandard/xyte)                               |
| **xtandard-image**                 | A self-hosted image and video processing server in Go and libvips: imgproxy-compatible URLs plus the imgix, Cloudinary, ImageKit, Cloudflare and Thumbor dialects, with a TypeScript client (`@xtandard/image`) | [Docs](https://me.xantiagoma.com/xtandard-image/) · [GitHub](https://github.com/xantiagoma/xtandard-image) · [npm](https://www.npmjs.com/package/@xtandard/image)          |

### Related

- [drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor): cursor-based pagination for Drizzle ORM
- [drizzle-audit](https://github.com/xantiagoma/drizzle-audit): configurable audit logging for Drizzle ORM

## License

MIT
