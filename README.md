<p align="center">
  <img src="./assets/logo.png" alt="xantiagoma" width="120" />
</p>

<h1 align="center">xantiagoma</h1>

<p align="center">
  Lightweight, type-safe TypeScript utilities — zero dependencies for the core.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/xantiagoma"><img src="https://img.shields.io/npm/v/xantiagoma?color=blue" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/xantiagoma"><img src="https://img.shields.io/npm/dm/xantiagoma" alt="npm downloads" /></a>
  <a href="https://github.com/xantiagoma/xantiagoma-lib/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/xantiagoma" alt="license" /></a>
</p>

---

## Install

```bash
npm install xantiagoma
```

Release process notes live in [docs/RELEASING.md](./docs/RELEASING.md).

## Entry Points

| Import                          | Description                                  | Dependencies                         |
| ------------------------------- | -------------------------------------------- | ------------------------------------ |
| `xantiagoma`                    | Core utilities (isomorphic, zero deps)       | none                                 |
| `xantiagoma/interval`           | Generic `Interval<T>` (Guava Range)          | none                                 |
| `xantiagoma/dinero`             | Money intervals (`Interval` of money)        | `dinero.js`                          |
| `xantiagoma/decimal`            | Exact-decimal intervals (decimal.js)         | `decimal.js`                         |
| `xantiagoma/big`                | Exact-decimal intervals (big.js)             | `big.js`                             |
| `xantiagoma/bignumber`          | Exact-decimal intervals (bignumber.js)       | `bignumber.js`                       |
| `xantiagoma/fraction`           | Exact-rational intervals (fraction.js)       | `fraction.js`                        |
| `xantiagoma/semver`             | Semantic-version range intervals             | `semver`                             |
| `xantiagoma/ip`                 | IPv4/IPv6 address & CIDR intervals           | `ipaddr.js`                          |
| `xantiagoma/pagination`         | Pagination + keyset helpers                  | none                                 |
| `xantiagoma/pagination/drizzle` | Drizzle adapter for pagination keysets       | `drizzle-orm`                        |
| `xantiagoma/pagination/kysely`  | Kysely adapter for pagination keysets        | `kysely`                             |
| `xantiagoma/pagination/knex`    | Knex adapter for pagination keysets          | none                                 |
| `xantiagoma/pagination/mongo`   | Mongo/Mongoose adapter for keysets           | none                                 |
| `xantiagoma/pagination/prisma`  | Prisma adapter for pagination keysets        | none                                 |
| `xantiagoma/web`                | Browser/FormData utilities                   | none                                 |
| `xantiagoma/tanstack`           | nuqs-style URL query state (TanStack Router) | `react`, `@tanstack/react-router`    |
| `xantiagoma/tanstack/server`    | Framework-free parsers/serializer/loader     | none                                 |
| `xantiagoma/tanstack/testing`   | Headless testing adapter (no router)         | `react`                              |
| `xantiagoma/tanstack/temporal`  | Temporal-kind URL parsers                    | `@js-temporal/polyfill`, `valibot`   |
| `xantiagoma/tanstack/rison`     | Rison value codec for `parseAsCodec`         | `@effective/rison`, `valibot`        |
| `xantiagoma/ulid`               | Prefixed ULID generation + helpers           | `ulid`                               |
| `xantiagoma/temporal`           | Date/time/duration + Temporal intervals      | `@js-temporal/polyfill`, `itty-time` |
| `xantiagoma/dataloader`         | DataLoader factory                           | `dataloader`                         |
| `xantiagoma/unstorage`          | Cache helpers with unstorage                 | `unstorage`, `ohash`                 |
| `xantiagoma/valibot`            | TimeZone validation schema                   | `valibot`                            |
| `xantiagoma/sonner`             | Toast streaming for iterables                | `sonner`, `react`                    |
| `xantiagoma/react`              | React hooks + components                     | `react`, `@tanstack/react-query`     |

Sub-entry dependencies are **optional peer deps** — only install what you use.

## Core Utilities (`xantiagoma`)

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

| Export                                                        | Description      | Source                 | Tests                          |
| ------------------------------------------------------------- | ---------------- | ---------------------- | ------------------------------ |
| `ensureString` / `naturalSortCompare` / `jaroWinklerDistance` | String utilities | [src](./src/string.ts) | [tests](./test/string.test.ts) |

### Misc

| Export                                      | Description                             | Source                                | Tests                                         |
| ------------------------------------------- | --------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `cast<T>`                                   | Unsafe `as T` type cast                 | [src](./src/cast.ts)                  | [tests](./test/cast.test.ts)                  |
| `log`                                       | `console.log` that returns its argument | [src](./src/log.ts)                   | [tests](./test/log.test.ts)                   |
| `prepareLoaderResult`                       | Map DB rows to DataLoader key order     | [src](./src/prepare-loader-result.ts) | [tests](./test/prepare-loader-result.test.ts) |
| `resolveStreamSource`                       | Resolve `StreamSource<T>`               | [src](./src/stream-source.ts)         | [tests](./test/stream-source.test.ts)         |
| `secondsToMs` / `minutesToMs` / `hoursToMs` | Time unit converters                    | [src](./src/time-convert.ts)          | [tests](./test/time-convert.test.ts)          |

## Interval Utilities (`xantiagoma/interval`)

A generic, immutable `Interval<T>` over any ordered type — modeled on Guava's
`Range` + `DiscreteDomain`. The engine knows nothing about `T` except through an
injected `IntervalDomain<T>` (compare, optional successor/measure/format/parse,
and the domain's `±∞` values). Zero dependencies. **Full guide:
[docs/INTERVAL.md](./docs/INTERVAL.md).**

```ts
import { NumberInterval, IntegerInterval } from "xantiagoma/interval";

const r = new NumberInterval({ start: 0, startClose: true, end: 10, endClose: false }); // [0,10)
r.contains(5); // true
r.union(NumberInterval.closedOpen(10, 20))?.toString(); // "[0,20)"
NumberInterval.parse("(-Infinity,5]").contains(-3); // true

// discrete domains merge epsilon-adjacent ranges:
IntegerInterval.closed(1, 5).union(IntegerInterval.closed(6, 10))?.toString(); // "[1,10]"
```

| Export                                                                                      | Description                                             | Source                           | Tests                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------- | ---------------------------------------- |
| `Interval`                                                                                  | Immutable interval engine (set algebra over a domain)   | [src](./src/interval.ts)         | [tests](./test/interval.test.ts)         |
| `defineIntervalType`                                                                        | Bind a domain → `new`-able interval class + statics     | [src](./src/interval.ts)         | [tests](./test/interval.test.ts)         |
| `parseInterval` / `mergeIntervals`                                                          | Parse `[a,b)` strings; merge a bag into disjoint pieces | [src](./src/interval.ts)         | [tests](./test/interval.test.ts)         |
| `numberDomain` / `integerDomain` / `bigIntDomain` / `dateDomain` / `stringDomain`           | Built-in `IntervalDomain<T>`s (zero-dep)                | [src](./src/interval-domains.ts) | [tests](./test/interval-domains.test.ts) |
| `NumberInterval` / `IntegerInterval` / `BigIntInterval` / `DateInterval` / `StringInterval` | Ready-to-use classes (incl. lexicographic strings)      | [src](./src/interval-domains.ts) | [tests](./test/interval-domains.test.ts) |
| `createOrdinalInterval(labels)`                                                             | Discrete intervals over an ordered label list (enums)   | [src](./src/interval-domains.ts) | [tests](./test/interval-domains.test.ts) |

**Temporal intervals** (`xantiagoma/temporal`, peer `@js-temporal/polyfill`) — the
same engine bound to the TC39 `Temporal` types:
`InstantInterval`, `ZonedDateTimeInterval`, `PlainDateInterval` (discrete, ε 1 day),
`PlainDateTimeInterval`, `PlainTimeInterval` (+ the matching `instantDomain` … exports).
Ordering/membership are nanosecond-exact; `length()`/`middle()` are millisecond-granular
(day-granular for `PlainDate`) — see [docs/INTERVAL.md](./docs/INTERVAL.md#temporal-intervals).

```ts
import { PlainTimeInterval, InstantInterval } from "xantiagoma/temporal";
import { Temporal } from "@js-temporal/polyfill";

const shift = PlainTimeInterval.closedOpen(
  Temporal.PlainTime.from("09:00"),
  Temporal.PlainTime.from("17:00"),
);
shift.contains(Temporal.PlainTime.from("12:30")); // true
shift.length(); // 28_800_000 (ms = 8h)
```

**Money intervals** (`xantiagoma/dinero`, peer `dinero.js`) — the engine bound to
dinero.js v2 values, **discrete** with the epsilon being one minor unit (1 cent for
USD, 1 yen for JPY) so adjacent ranges merge and `length()` counts amounts. Build a
class per currency with `createDineroInterval(currency)` — see
[docs/INTERVAL.md](./docs/INTERVAL.md#money-intervals).

```ts
import { createDineroInterval } from "xantiagoma/dinero";
import { dinero, USD } from "dinero.js";

const UsdInterval = createDineroInterval(USD);
const tier = UsdInterval.closed(
  dinero({ amount: 5_000, currency: USD }),
  dinero({ amount: 10_000, currency: USD }),
);
tier.contains(dinero({ amount: 7_500, currency: USD })); // true ($75 ∈ [$50, $100])
tier.toString(); // "[5000,10000]"  (minor units)
```

**Decimal intervals** (`xantiagoma/decimal`, peer `decimal.js`) — an exact, continuous
alternative to `NumberInterval` when IEEE-754 float fuzz is unacceptable. Ordering,
membership, and the string form are exact arbitrary-precision; see
[docs/INTERVAL.md](./docs/INTERVAL.md#decimal-intervals).

```ts
import { DecimalInterval } from "xantiagoma/decimal";
import Decimal from "decimal.js";

DecimalInterval.closed(new Decimal("0.1"), new Decimal("0.3")).length(); // 0.2 (not 0.19999999999999998)
DecimalInterval.closed(new Decimal("0.1"), new Decimal("0.3")).toString(); // "[0.1,0.3]"
```

Same exact-decimal model, different backing library (pick the one you already use):
**`xantiagoma/big`** (`BigInterval`, peer `big.js` — smaller) and **`xantiagoma/bignumber`**
(`BigNumberInterval`, peer `bignumber.js`).

**Fraction intervals** (`xantiagoma/fraction`, peer `fraction.js`) — exact **rationals**:
`1/3` is lossless (never rounds, even where decimals can't) and renders as `"1/3"`. See
[docs/INTERVAL.md](./docs/INTERVAL.md#fraction-intervals).

```ts
import { FractionInterval } from "xantiagoma/fraction";
import Fraction from "fraction.js";

const third = (n: number) => new Fraction(n, 3);
FractionInterval.closed(third(1), third(2)).toString(); // "[1/3,2/3]"
FractionInterval.closed(third(1), third(2)).contains(new Fraction(1, 2)); // true
```

**Semver intervals** (`xantiagoma/semver`, peer `semver`) — a version range IS an interval
(`[">=1.2.0","<2.0.0")`). Exact precedence ordering; see
[docs/INTERVAL.md](./docs/INTERVAL.md#semver-intervals).

```ts
import { SemverInterval } from "xantiagoma/semver";

const compatible = SemverInterval.closedOpen("1.2.0", "2.0.0");
compatible.contains("1.5.3"); // true
compatible.contains("2.0.0"); // false
```

**IP intervals** (`xantiagoma/ip`, peer `ipaddr.js`) — IPv4/IPv6 ranges, discrete (ε = one
address), CIDR-aware. See [docs/INTERVAL.md](./docs/INTERVAL.md#ip-intervals).

```ts
import { Ipv4Interval } from "xantiagoma/ip";

const lan = Ipv4Interval.cidr("192.168.0.0/16");
lan.contains(Ipv4Interval.ip("192.168.1.50")); // true
lan.length(); // 65536
```

Strings and ordered enums need no extra dependency — `StringInterval` (lexicographic) and
`createOrdinalInterval([...])` (ordered labels) ship in `xantiagoma/interval`.

## Pagination Utilities (`xantiagoma/pagination`)

Source-agnostic pagination: import from `xantiagoma/pagination`, provide fetchers for your data source (SQL, Drizzle, Prisma, Mongoose, HTTP...), and the paginator handles input styles (`page`/`pageSize`, `limit`/`offset`, cursor), `hasNextPage` lookahead, backward (scroll-up) pagination, and a uniform result envelope. **Full guide: [docs/PAGINATION.md](./docs/PAGINATION.md)** — backend recipes for SQL drivers, ORMs/query builders, Mongo, Firestore, DynamoDB, Redis sorted sets, Elasticsearch/OpenSearch, analytics warehouses, HTTP APIs, REST/GraphQL endpoints, cursor codecs, and frontend integration.

Sync/async adaptive: pass all-sync fetchers and codec (e.g. an in-memory array) and `paginate()` returns plain values — no `await` needed; any async piece (even just an async cursor encoder) makes results Promises, reflected in the types. The pattern is documented in [docs/sync-async-adaptive.md](./docs/sync-async-adaptive.md).

| Import                          | Export                      | Description                                                                | Source                             | Tests                                      |
| ------------------------------- | --------------------------- | -------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------ |
| `xantiagoma/pagination`         | `createPaginator`           | Paginator over user-provided fetchers; `pages()`/`items()` async iteration | [src](./src/pagination.ts)         | [tests](./test/pagination.test.ts)         |
| `xantiagoma/pagination`         | `toOffsetWindow`            | Page/offset input → `{ limit, offset }`                                    | [src](./src/pagination.ts)         | [tests](./test/pagination.test.ts)         |
| `xantiagoma/pagination`         | `createCursorCodec`         | Pluggable opaque-cursor codec (JSON + base64url)                           | [src](./src/cursor-codec.ts)       | [tests](./test/cursor-codec.test.ts)       |
| `xantiagoma/pagination`         | `createKeysetSpec`          | Portable keyset `where()`/`orderBy()` AST                                  | [src](./src/keyset.ts)             | [tests](./test/keyset.test.ts)             |
| `xantiagoma/pagination`         | `keysetSqlExpression`       | Mark server-owned computed SQL expressions for raw keyset helpers          | [src](./src/keyset.ts)             | [tests](./test/keyset.test.ts)             |
| `xantiagoma/pagination`         | `toKeysetWhereSql`          | Keyset `WHERE` → parameterized SQL + params                                | [src](./src/keyset.ts)             | [tests](./test/keyset.test.ts)             |
| `xantiagoma/pagination`         | `toKeysetOrderBySql`        | Keyset order → SQL `ORDER BY` fragment                                     | [src](./src/keyset.ts)             | [tests](./test/keyset.test.ts)             |
| `xantiagoma/pagination/drizzle` | `toDrizzleKeyset`           | Keyset AST → Drizzle `where`/`orderBy` helpers                             | [src](./src/pagination-drizzle.ts) | [tests](./test/pagination-drizzle.test.ts) |
| `xantiagoma/pagination/kysely`  | `toKyselyKeyset`            | Keyset AST → Kysely `where`/`orderBy` helpers                              | [src](./src/pagination-kysely.ts)  | [tests](./test/pagination-kysely.test.ts)  |
| `xantiagoma/pagination/knex`    | `applyKeysetToKnex`         | Apply keyset AST to Knex `whereRaw`/`orderByRaw`                           | [src](./src/pagination-knex.ts)    | [tests](./test/pagination-knex.test.ts)    |
| `xantiagoma/pagination/mongo`   | `toMongoKeyset`             | Keyset AST → Mongo/Mongoose `filter`/`sort` objects                        | [src](./src/pagination-mongo.ts)   | [tests](./test/pagination-mongo.test.ts)   |
| `xantiagoma/pagination/prisma`  | `toPrismaKeyset`            | Keyset AST → Prisma `where`/`orderBy` objects                              | [src](./src/pagination-prisma.ts)  | [tests](./test/pagination-prisma.test.ts)  |
| `xantiagoma/pagination`         | `parsePaginationParams`     | Query params → `PaginationInput` (with clamping)                           | [src](./src/pagination-params.ts)  | [tests](./test/pagination-params.test.ts)  |
| `xantiagoma/pagination`         | `fromRelayArgs`             | Relay `first`/`after`/`last`/`before` → input                              | [src](./src/pagination-params.ts)  | [tests](./test/pagination-params.test.ts)  |
| `xantiagoma/pagination`         | `toRelayConnection`         | Result → Relay connection (`edges`, `pageInfo`)                            | [src](./src/pagination-output.ts)  | [tests](./test/pagination-output.test.ts)  |
| `xantiagoma/pagination`         | `toRestEnvelope`            | Result → `{ data, meta }` REST envelope                                    | [src](./src/pagination-output.ts)  | [tests](./test/pagination-output.test.ts)  |
| `xantiagoma/pagination`         | `infinitePaginationOptions` | TanStack `useInfiniteQuery` config (dep-free)                              | [src](./src/pagination-output.ts)  | [tests](./test/pagination-output.test.ts)  |

```ts
import {
  createPaginator,
  fromRelayArgs,
  parsePaginationParams,
  toRestEnvelope,
} from "xantiagoma/pagination";

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

## Web Utilities (`xantiagoma/web`)

| Export                  | Description                         | Source                                    | Tests                                       |
| ----------------------- | ----------------------------------- | ----------------------------------------- | ------------------------------------------- |
| `formDataToObject`      | `FormData` → plain object           | [src](./src/form-data-to-object-utils.ts) | [tests](./test/form-data-to-object.test.ts) |
| `fetchWithProgress`     | Fetch with upload/download progress | [src](./src/fetch-with-progress.ts)       | [tests](./test/fetch-with-progress.test.ts) |
| `createHttpInterceptor` | Intercept fetch + XHR with rules    | [src](./src/intercept-http.ts)            | [tests](./test/intercept-http.test.tsx)     |

## Sonner Utilities (`xantiagoma/sonner`)

Toast helpers for streaming iterables/generators through [Sonner](https://sonner.emilkowal.ski/).

| Export             | Description                                                             | Source                       | Tests                                |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------- | ------------------------------------ |
| `toastStream`      | Blocking/awaitable stream toast; resolves to `{ items, returnValue }`   | [src](./src/toast-stream.ts) | [tests](./test/toast-stream.test.ts) |
| `toastStreamAsync` | Non-blocking stream toast; returns toast id immediately with `unwrap()` | [src](./src/toast-stream.ts) | [tests](./test/toast-stream.test.ts) |

Use `toastStream` when the caller should wait for completion:

```ts
import { toastStream } from "xantiagoma/sonner";

const { items, returnValue } = await toastStream(source, {
  loading: "Loading...",
  streaming: ({ count }) => `Received ${count}`,
  success: ({ count }) => `Done: ${count} items`,
});
```

Use `toastStreamAsync` when the caller should continue immediately, matching
Sonner's `toast.promise(...).unwrap()` style:

```ts
import { toastStreamAsync } from "xantiagoma/sonner";

const toastId = toastStreamAsync(source, { loading: "Loading..." });
const { items, returnValue } = await toastId.unwrap();
```

## React Utilities (`xantiagoma/react`)

| Export                         | Description                         | Source                                 | Tests                                           |
| ------------------------------ | ----------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `Providers` / `provider`       | Compose providers without nesting   | [src](./src/providers.tsx)             | [tests](./test/providers.test.tsx)              |
| `usePreventAutoFocus`          | Prevent auto-focus in modals        | [src](./src/use-prevent-auto-focus.ts) | [tests](./test/use-prevent-auto-focus.test.tsx) |
| `useDynamicRefs`               | Dynamic ref registry by key         | [src](./src/use-dynamic-refs.ts)       | [tests](./test/use-dynamic-refs.test.tsx)       |
| `useStream` / `StreamRenderer` | Stream consumption hook + component | [src](./src/stream-renderer.tsx)       | [tests](./test/stream-renderer.test.tsx)        |

## TanStack URL State (`xantiagoma/tanstack`)

nuqs-style, **component-owned** URL query state for TanStack Router (and Start).
`useQueryState` behaves like `useState`, but backed by the URL — reusable
components own "their" query key without importing a route object. Per-key
parsers, an optimistic store, rate-limited URL commits, shallow-by-default
updates, atomic multi-key batching, a framework-free server/loader/serializer
core, and a `validateSearch`-ready Standard Schema. **Full guide:
[docs/TANSTACK.md](./docs/TANSTACK.md).**

```tsx
import { NuqsAdapter, useQueryState, parseAsInteger } from "xantiagoma/tanstack";

// once, inside RouterProvider (e.g. your __root route component):
<NuqsAdapter>{/* app */}</NuqsAdapter>;

function Pagination() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  return <button onClick={() => setPage((p) => p + 1)}>Next</button>; // setPage(null) removes the key
}
```

| Import                         | Export                                                                        | Description                                            | Source                                             |
| ------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `xantiagoma/tanstack`          | `useQueryState` / `useQueryStates` / `useUrlSearchString`                     | nuqs-style hooks backed by the URL                     | [src](./src/tanstack/react/)                       |
| `xantiagoma/tanstack`          | `NuqsAdapter` / `TanStackQueryStateAdapter`                                   | Bridges the store to TanStack Router                   | [src](./src/tanstack/adapters/tanstack-router.tsx) |
| `xantiagoma/tanstack`          | `parseAs*` (15 built-ins) / `createParser` / `parseAsCodec` / `withTransport` | Per-key parsers + custom codec/transport combinators   | [src](./src/tanstack/core/built-in-parsers.ts)     |
| `xantiagoma/tanstack/server`   | `createLoader` / `createSerializer` / `createStandardSchemaV1`                | Framework-free (loaders, `validateSearch`, server fns) | [src](./src/tanstack/server.ts)                    |
| `xantiagoma/tanstack/testing`  | `QueryStateTestingAdapter`                                                    | Drive hooks from a static search string, no router     | [src](./src/tanstack/adapters/testing.tsx)         |
| `xantiagoma/tanstack/temporal` | `parseAsInstant` / `parseAsPlainDate` / … / `parseAsTimeZone`                 | URL parsers for the six Temporal kinds                 | [src](./src/tanstack/temporal.ts)                  |
| `xantiagoma/tanstack/rison`    | `risonCodec`                                                                  | Readable, canonical Rison codec for `parseAsCodec`     | [src](./src/tanstack/rison.ts)                     |

`keepSubDelims` (keep `( ) , : ! '` raw in the address bar, e.g. for Rison
tokens) lives in [`xantiagoma/web`](#web-utilities-xantiagomaweb) and is also
re-exported from `xantiagoma/tanstack`.

## Recommended Libraries

These are libraries we use and recommend. They're not re-exported — install them directly:

| Library                                                                    | Description                          |
| -------------------------------------------------------------------------- | ------------------------------------ |
| [es-toolkit](https://github.com/toss/es-toolkit)                           | Modern lodash alternative            |
| [ohash](https://github.com/unjs/ohash)                                     | Object hashing                       |
| [unstorage](https://github.com/unjs/unstorage)                             | Universal key-value storage          |
| [cockatiel](https://github.com/connor4312/cockatiel)                       | Retry / circuit breaker / bulkhead   |
| [chroma-js](https://github.com/gka/chroma.js)                              | Color manipulation                   |
| [xbytes](https://github.com/Zak-Olyarnik/xbytes)                           | Byte size formatting                 |
| [etiket](https://github.com/nicholasgasior/etiket)                         | Barcode generation                   |
| [portakal](https://www.npmjs.com/package/portakal)                         | Printer / ESC/POS                    |
| [hucre](https://www.npmjs.com/package/hucre)                               | Spreadsheet utilities                |
| [@gobrand/tiempo](https://www.npmjs.com/package/@gobrand/tiempo)           | Time formatting / parsing            |
| [dinero.js](https://dinerojs.com/)                                         | Immutable, type-safe money handling  |
| [decimal.js](https://github.com/MikeMcl/decimal.js)                        | Arbitrary-precision decimals         |
| [big.js](https://github.com/MikeMcl/big.js)                                | Minimalist arbitrary-precision dec.  |
| [bignumber.js](https://github.com/MikeMcl/bignumber.js)                    | Arbitrary-precision decimals/bases   |
| [fraction.js](https://github.com/rawify/Fraction.js)                       | Exact rational numbers               |
| [semver](https://github.com/npm/node-semver)                               | Semantic version parsing/compare     |
| [ipaddr.js](https://github.com/whitequark/ipaddr.js)                       | IPv4/IPv6 address parsing            |
| [tactus](https://www.npmjs.com/package/tactus)                             | Haptic feedback for web              |
| [liveline](https://www.npmjs.com/package/liveline)                         | Animated line charts (React)         |
| [react-lzy-img](https://www.npmjs.com/package/react-lzy-img)               | Lazy loading images (React)          |
| [masonic](https://github.com/jaredLunde/masonic)                           | Virtualized masonry layout (React)   |
| [p-map](https://github.com/sindresorhus/p-map)                             | Concurrent async mapping             |
| [motion](https://motion.dev/)                                              | Animation library (React)            |
| [tailwind-merge](https://github.com/dcastil/tailwind-merge)                | Merge Tailwind classes               |
| [lucide-react](https://lucide.dev/)                                        | Icon library (React)                 |
| [jotai](https://jotai.org/)                                                | Atomic state management (React)      |
| [permix](https://www.npmjs.com/package/permix)                             | Permission management                |
| [std-env](https://github.com/unjs/std-env)                                 | Runtime environment detection        |
| [ufo](https://github.com/unjs/ufo)                                         | URL utilities                        |
| [@total-typescript/ts-reset](https://github.com/total-typescript/ts-reset) | Stricter TypeScript defaults         |
| [better-auth](https://www.better-auth.com/)                                | Authentication framework             |
| [drizzle-orm](https://orm.drizzle.team/)                                   | TypeScript ORM                       |
| [drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor)             | Cursor-based pagination for Drizzle  |
| [drizzle-audit](https://github.com/xantiagoma/drizzle-audit)               | Audit logging for Drizzle            |
| [elysia](https://elysiajs.com/)                                            | Bun-first web framework              |
| [hono](https://hono.dev/)                                                  | Lightweight web framework            |
| [inngest](https://www.inngest.com/)                                        | Background jobs + durable functions  |
| [stripe](https://stripe.com/)                                              | Payment processing                   |
| [paykit](https://github.com/getpaykit/paykit)                              | Payment toolkit for Stripe           |
| [@tanstack/react-query](https://tanstack.com/query)                        | Async state management (React)       |
| [@tanstack/react-table](https://tanstack.com/table)                        | Headless table (React)               |
| [@tanstack/react-form](https://tanstack.com/form)                          | Form management (React)              |
| [@tanstack/react-virtual](https://tanstack.com/virtual)                    | Virtualized lists (React)            |
| [ai](https://sdk.vercel.ai/)                                               | Vercel AI SDK                        |
| [graphql-yoga](https://the-guild.dev/graphql/yoga-server)                  | GraphQL server                       |
| [pothos](https://pothos-graphql.dev/)                                      | GraphQL schema builder               |
| [react-router](https://reactrouter.com/)                                   | Routing (React)                      |
| [class-variance-authority](https://cva.style/)                             | Component variant classes            |
| [clsx](https://github.com/lukeed/clsx)                                     | Conditional classnames               |
| [next-themes](https://github.com/pacocoursey/next-themes)                  | Theme management (React)             |
| [react-email](https://react.email/)                                        | Email templates (React)              |
| [@uppy/core](https://uppy.io/)                                             | File upload                          |
| [dotenv](https://github.com/motdotla/dotenv)                               | Environment variables                |
| [citty](https://github.com/unjs/citty)                                     | CLI framework                        |
| [evlog](https://www.npmjs.com/package/evlog)                               | Event logging                        |
| [@electric-sql/pglite](https://pglite.dev/)                                | In-memory PostgreSQL                 |
| [neverthrow](https://github.com/supermacro/neverthrow)                     | Type-safe Result type                |
| [ts-pattern](https://github.com/gvergnaud/ts-pattern)                      | Exhaustive pattern matching          |
| [nanoid](https://github.com/ai/nanoid)                                     | Tiny unique ID generator             |
| [superjson](https://github.com/flightcontrolhq/superjson)                  | Serialize Date, Map, Set via JSON    |
| [destr](https://github.com/unjs/destr)                                     | Safe, fast JSON.parse alternative    |
| [dequal](https://github.com/lukeed/dequal)                                 | Tiny deep equality check             |
| [klona](https://github.com/lukeed/klona)                                   | Tiny deep clone                      |
| [mutative](https://github.com/unadlib/mutative)                            | Fast immutable updates (like Immer)  |
| [ofetch](https://github.com/unjs/ofetch)                                   | Better fetch with retries + parsing  |
| [ky](https://github.com/sindresorhus/ky)                                   | Tiny fetch-based HTTP client         |
| [consola](https://github.com/unjs/consola)                                 | Elegant structured logger            |
| [p-queue](https://github.com/sindresorhus/p-queue)                         | Promise queue with concurrency       |
| [croner](https://github.com/Hexagon/croner)                                | Cron scheduler (Node + browser)      |
| [oslo](https://github.com/pilcrowonpaper/oslo)                             | Auth utilities (TOTP, JWT, hashing)  |
| [arctic](https://github.com/pilcrowonpaper/arctic)                         | OAuth 2.0 provider integrations      |
| [casl](https://github.com/stalniy/casl)                                    | Isomorphic authorization             |
| [unctx](https://github.com/unjs/unctx)                                     | Composables via AsyncLocalStorage    |
| [execa](https://github.com/sindresorhus/execa)                             | Better child_process                 |
| [knip](https://github.com/webpro-nl/knip)                                  | Find unused code + dependencies      |
| [clack](https://github.com/bombshell-dev/clack)                            | Beautiful CLI prompts + spinners     |
| [sonner](https://github.com/emilkowalski/sonner)                           | Toast notifications (React)          |
| [vaul](https://github.com/emilkowalski/vaul)                               | Drawer component (React)             |
| [cmdk](https://github.com/pacocoursey/cmdk)                                | Command menu (React)                 |
| [embla-carousel](https://github.com/davidjerleke/embla-carousel)           | Lightweight carousel                 |
| [dnd-kit](https://github.com/clauderic/dnd-kit)                            | Drag and drop toolkit (React)        |
| [nuqs](https://github.com/47ng/nuqs)                                       | Type-safe URL search params (React)  |
| [@tanstack/react-router](https://tanstack.com/router)                      | Type-safe file-based routing (React) |
| [@effective/rison](https://github.com/sebastian-software/effective-rison)  | URL-friendly JSON encoding (Rison)   |
| [react-error-boundary](https://github.com/bvaughn/react-error-boundary)    | Error boundary component (React)     |
| [react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook) | Keyboard shortcuts hook (React)      |
| [auto-animate](https://github.com/formkit/auto-animate)                    | Zero-config DOM animations           |
| [satori](https://github.com/vercel/satori)                                 | JSX/HTML to SVG (OG images)          |
| [orama](https://github.com/oramasearch/orama)                              | In-memory full-text + vector search  |
| [gql.tada](https://github.com/0no-co/gql.tada)                             | Typed GraphQL documents at compile   |
| [kysely](https://github.com/kysely-org/kysely)                             | Type-safe SQL query builder          |
| [currency.js](https://github.com/scurker/currency.js)                      | Safe currency arithmetic             |
| [thumbhash](https://github.com/evanw/thumbhash)                            | Image placeholder algorithm          |
| [noble-hashes](https://github.com/paulmillr/noble-hashes)                  | Audited crypto hashes (pure TS)      |
| [better-all](https://github.com/shuding/better-all)                        | Better Promise.all with named keys   |
| [better-result](https://github.com/dmmulroy/better-result)                 | Rust-like Result type for TS         |
| [fuse.js](https://www.fusejs.io/)                                          | Lightweight fuzzy search             |
| [files-sdk](https://github.com/haydenbleasel/files-sdk)                    | Unified file storage SDK             |
| [streamdown](https://github.com/vercel/streamdown)                         | Stream Markdown rendering            |
| [ai-elements](https://github.com/vercel/ai-elements)                       | AI-powered UI components             |
| [tiptap](https://tiptap.dev/)                                              | Headless rich text editor            |
| [better-notify](https://github.com/better-notify/better-notify)            | Notification management              |
| [@vercel/chat](https://github.com/vercel/chat)                             | Chat UI components                   |
| [@vercel/workflow](https://github.com/vercel/workflow)                     | Durable workflow engine              |
| [trigger.dev](https://trigger.dev/)                                        | Background jobs platform             |
| [temporal](https://temporal.io/)                                           | Durable workflow orchestration       |
| [@vercel/sandbox](https://github.com/vercel/sandbox)                       | Code sandbox execution               |
| [reactflow](https://reactflow.dev/)                                        | Node-based graph editor (React)      |
| [date-fns](https://date-fns.org/)                                          | Modern date utility library          |
| [cheerio](https://cheerio.js.org/)                                         | Fast HTML parsing + manipulation     |
| [dexie](https://dexie.org/)                                                | IndexedDB wrapper with clean API     |

## See Also

- [drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor) — Cursor-based pagination for Drizzle ORM
- [drizzle-audit](https://github.com/xantiagoma/drizzle-audit) — Configurable audit logging for Drizzle ORM

## License

MIT
