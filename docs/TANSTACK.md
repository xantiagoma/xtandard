# TanStack URL State (`@xtandard/lib/tanstack`)

nuqs-style, **component-owned** URL query state for TanStack Router (and
TanStack Start). `useQueryState` behaves like `useState`, but backed by the
URL — reusable components own "their" query key without importing a route
object.

Why not just TanStack's `useSearch`? That treats search as **route-contract**
state: great for loaders/SSR, awkward for a reusable table/drawer/filter that
shouldn't know its route. This module rebuilds the nuqs programming model
(per-key parsers, an optimistic store, rate-limited URL commits, shallow-by-
default updates) on top of TanStack navigation — and bridges _into_ the router
only when you opt in.

> Peer deps: `react` + `@tanstack/react-router` for the hooks/adapter;
> `@xtandard/lib/tanstack/server` is framework-free (zero deps);
> `@xtandard/lib/tanstack/temporal` adds `@js-temporal/polyfill` + `valibot`;
> `@xtandard/lib/tanstack/rison` adds `@effective/rison` + `valibot`. All optional.

## Setup

Wrap the app **inside** `RouterProvider` (the adapter uses `useRouter`):

```tsx
import { NuqsAdapter } from "@xtandard/lib/tanstack";

// in your root route component:
<NuqsAdapter>{/* app */}</NuqsAdapter>;
```

## Usage

```tsx
import { useQueryState, parseAsInteger, parseAsString } from "@xtandard/lib/tanstack";

function SearchBox() {
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  return <input value={q} onChange={(e) => setQ(e.target.value)} />;
}

function Pagination() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  return <button onClick={() => setPage((p) => p + 1)}>Next</button>;
  // setPage(null) removes the key
}
```

Multiple keys that move together:

```tsx
import { useQueryStates, parseAsIndex, parseAsString } from "@xtandard/lib/tanstack";

const tableSearch = {
  pageIndex: parseAsIndex.withDefault(0),
  sort: parseAsString.withDefault("createdAt"),
};

function Table() {
  const [{ pageIndex, sort }, setState] = useQueryStates(tableSearch);
  // setState({ pageIndex: 2 }) — atomic, preserves unrelated params
  // setState(null) — clears all managed keys
}
```

## Options

Defaults match nuqs: `{ history: "replace", shallow: true, scroll: false,
clearOnDefault: true, clearOnInvalid: true, limitUrlUpdates: throttle(50) }`.

Set per-parser (`.withOptions`), per-hook, or per-call. Precedence:
**call > parser > hook > adapter defaults > library defaults**.

- `shallow: true` (default) — updates the URL via the History API only; route
  loaders / SSR do **not** run. Component-local.
- `shallow: false` — routes the update through TanStack navigation, so loaders,
  validation, pending state, and Start SSR participate.
- `clearOnDefault: true` (default) — writing a value equal to the parser default
  removes the key from the URL.
- `clearOnInvalid: true` (default) — a key whose raw value fails to parse (stale
  or tampered junk) is stripped on read, resolving cleanly to the default.
- `limitUrlUpdates: throttle(ms) | debounce(ms)` — hook state still updates
  instantly; only the URL commit is rate-limited. `throttle(Infinity)` keeps
  state in sync without ever touching the URL.

## Parsers

`parseAsString`, `parseAsInteger`, `parseAsFloat`, `parseAsHex`,
`parseAsBoolean`, `parseAsIndex` (1-indexed URL ⇄ 0-indexed state),
`parseAsIsoDateTime`, `parseAsIsoDate`, `parseAsTimestamp`,
`parseAsStringLiteral`, `parseAsNumberLiteral`, `parseAsStringEnum`,
`parseAsArrayOf` (comma-separated), `parseAsNativeArrayOf` (repeated keys,
`?tag=a&tag=b`), `parseAsJson(validator)`.

### Custom parsers, encoders & decoders

A parser is a `parse`/`serialize` pair (`createParser` / `createMultiParser` for
repeated keys):

```ts
import { createParser } from "@xtandard/lib/tanstack";

const parseAsDate = createParser({
  parse: (v) => (Number.isNaN(Date.parse(v)) ? null : new Date(v)),
  serialize: (d) => d.toISOString(),
  eq: (a, b) => a.valueOf() === b.valueOf(), // used by clearOnDefault
});
```

Need a separate **encoder/decoder** (opaque/transport-safe) stage on top? Two
combinators, both **synchronous** (URL parsing runs during render):

```ts
// 1. Adapt a codec (data ⇄ token) — structurally compatible with xtandard's
//    createCursorCodec(), so the same serializer/parser/encoder/decoder
//    overrides back URL state, pagination, and drizzle-cursor.
import { createCursorCodec } from "@xtandard/lib/pagination";
import { parseAsCodec } from "@xtandard/lib/tanstack";

const codec = createCursorCodec<{ id: number }>(); // JSON + base64url by default
const [cursor, setCursor] = useQueryState("cursor", parseAsCodec(codec));

// 2. Wrap any parser with a transport (encoder/decoder) layer.
import { encodeBase64Url, decodeBase64Url } from "@xtandard/lib";
import { withTransport, parseAsJson } from "@xtandard/lib/tanstack";

const opaque = withTransport(parseAsJson(schema), {
  encode: encodeBase64Url,
  decode: decodeBase64Url,
}).withDefault({});
```

Async codecs (`createCursorCodec` with WebCrypto stages) are **not** usable
here — parsing must be sync — but work fine in loaders/server functions.

### Standard Schema (Zod / Valibot / ArkType)

```ts
import { parseAsJson, parseAsStandardSchema } from "@xtandard/lib/tanstack";
import * as v from "valibot";

// Structured JSON value validated by a schema:
const filters = parseAsJson(v.object({ status: v.picklist(["open", "done"]) }));

// Scalar param validated by a schema:
const qty = parseAsStandardSchema(v.pipe(v.string(), v.transform(Number), v.number()));
```

`createStandardSchemaV1(parsers, { partialOutput })` goes the other direction —
turning a parser map into a Standard Schema for `validateSearch` / tRPC.

### Rison codec (`@xtandard/lib/tanstack/rison`)

Store a validated value as readable, canonical [Rison](https://github.com/sebastian-software/effective-rison)
(stable key order → the same value always yields the same URL):

```ts
import { parseAsCodec } from "@xtandard/lib/tanstack";
import { risonCodec } from "@xtandard/lib/tanstack/rison";
import * as v from "valibot";

const FiltersSchema = v.object({ status: v.picklist(["open", "done"]), tags: v.array(v.string()) });
const filters = parseAsCodec(risonCodec(FiltersSchema));
const [value, setValue] = useQueryState("filters", filters);
```

Pair the adapter's `serializeSearch` with `keepSubDelims` (from `@xtandard/lib/web`)
to keep the Rison `( ) , : ! '` readable in the address bar instead of
percent-encoded:

```tsx
import { NuqsAdapter } from "@xtandard/lib/tanstack";
import { keepSubDelims } from "@xtandard/lib/web";

<NuqsAdapter serializeSearch={keepSubDelims}>{/* app */}</NuqsAdapter>;
```

### Temporal parsers (`@xtandard/lib/tanstack/temporal`)

URL parsers for the six temporal "kinds" — each stores the canonical Temporal
string and parses back to the live `Temporal.*` object:

```ts
import { parseAsInstant, parseAsPlainDate, parseAsTimeZone } from "@xtandard/lib/tanstack/temporal";

const [at, setAt] = useQueryState("at", parseAsInstant); // 2026-06-18T16:00:00Z
const [day] = useQueryState("day", parseAsPlainDate); // 2026-12-25
const [tz] = useQueryState("tz", parseAsTimeZone); // America/Los_Angeles (validated)
```

`Temporal` comes from `@js-temporal/polyfill`; `parseAsTimeZone` validates IANA
ids via the `@xtandard/lib/valibot` TimeZone schema. (Available:
`parseAsInstant`, `parseAsPlainDate`, `parseAsPlainTime`, `parseAsPlainDateTime`,
`parseAsZonedDateTime`, `parseAsDuration`, `parseAsTimeZone`.)

## Parity with nuqs

Implemented: all 15 built-in parsers, `createParser`/`createMultiParser`,
`useQueryState`/`useQueryStates` (urlKeys, atomic batching, same-tick cross-hook
merging with a shared Promise), all options + adapter `defaultOptions` /
`processUrlSearchParams`, `throttle`/`debounce`/`defaultRateLimit`,
`createSerializer`, `createLoader` (strict mode), `createStandardSchemaV1`,
`inferParserType`, testing adapter. **Plus** `parseAsCodec`, `withTransport`,
`parseAsStandardSchema`, the Temporal parsers, and the Rison codec.

Deliberate differences:

- **No `createSearchParamsCache`.** It's a Next.js RSC tool (request-scoped via
  React `cache()`); TanStack Router/Start use loaders/server functions, so use
  `createLoader` + a route's `validateSearch` instead.
- **Throttle is trailing-batched** (one commit per window with the latest
  value), not nuqs's leading+trailing. Default rate limit is `throttle(50)`
  (set `limitUrlUpdates: throttle(120)` for Safari if needed).
- **Async codecs** can't back URL parsing (sync-only render path).

### TanStack Start (SSR)

Works on Start with no separate adapter. The adapter reads the **raw** search
from `router.history.location` (not router-core's re-serialized `searchStr`),
which is identical on the client and during SSR — so every parser, including
`parseAsNativeArrayOf` (repeated keys), round-trips and the server snapshot
matches the client (no hydration mismatch). Verified with a memory-history test.

One caveat: `shallow: false` updates go through `router.navigate`, which
re-serializes search globally — so a **native array under `shallow: false`**
will be written as `?tag=["a","b"]` (route-contract territory). For
loader/SSR-bound arrays use `parseAsArrayOf` (comma) or a route `validateSearch`.

## Server / route helpers (`@xtandard/lib/tanstack/server` — React-free)

```ts
import {
  createLoader,
  createSerializer,
  createStandardSchemaV1,
} from "@xtandard/lib/tanstack/server";

// Parse a URL / Request / URLSearchParams / record (sync or promise).
const loadSearch = createLoader(tableSearch);
const parsed = loadSearch(request.url); // strict mode available

// Build query strings / URLs.
const serialize = createSerializer(tableSearch);
serialize("/users", { pageIndex: 1 }); // "/users?page=2"

// Compose the SAME parsers into a route's validateSearch — the contract lives
// with the component, the route only imports it when loaders/SSR care.
export const Route = createFileRoute("/users")({
  validateSearch: createStandardSchemaV1(tableSearch, { partialOutput: true }),
});
```

## Testing (`@xtandard/lib/tanstack/testing`)

```tsx
import { QueryStateTestingAdapter } from "@xtandard/lib/tanstack/testing";

render(<Component />, {
  wrapper: ({ children }) => (
    <QueryStateTestingAdapter searchParams="?count=42" onUrlUpdate={(e) => updates.push(e)}>
      {children}
    </QueryStateTestingAdapter>
  ),
});
```

The testing adapter drives the hooks from a static search string and reports
commits via `onUrlUpdate` — no router required.
