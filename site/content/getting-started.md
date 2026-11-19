---
title: Getting started
description: Install @xtandard/lib, pick the entry points you need, and add only the optional peer dependencies those entry points use.
---

`@xtandard/lib` is one package with many entry points. The core (`@xtandard/lib`) has **zero
runtime dependencies** and runs anywhere JavaScript does: Node, Bun, Deno, browsers and edge
runtimes. Every other entry point wraps one area or one library, and declares that library as an
**optional peer dependency**. You install a peer only when you import the entry point that needs it.

## Install

```sh
npm install @xtandard/lib
# or
bun add @xtandard/lib
pnpm add @xtandard/lib
yarn add @xtandard/lib
```

The package ships ESM and CommonJS builds with type declarations for both. It is marked
`sideEffects: false`, so bundlers drop whatever you don't import.

## Your first imports

```ts
import { tryCatch, collect, wait } from "@xtandard/lib";

// Errors as values: [data, error] tuples, without try/catch at the call site.
const [config, error] = tryCatch(() => JSON.parse(raw)); // sync in → sync out
const [user, fetchError] = await tryCatch(fetch("/api/me").then((r) => r.json())); // promise in → promise out

// Drain any iterable or async iterable into an array.
const ids = await collect(streamOfIds());

await wait(250);
```

`tryCatch`, `collect` and a few others are **sync/async-adaptive**: give them synchronous inputs
and you get a plain value back; give them a promise or async input and you get a promise. See
[Sync/async-adaptive APIs](@BASE@/guides/sync-async-adaptive/).

## Pick an entry point

| You want to…                                                    | Import                                                    | Install as well                                           |
| --------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Handle errors, async work, iterables, disposables               | [`@xtandard/lib`](@BASE@/core/)                           | nothing                                                   |
| Model ranges of numbers, dates, money, versions, IPs            | [`@xtandard/lib/interval`](@BASE@/interval/) and siblings | nothing (or the value library: `dinero.js`, `semver`, …)  |
| Paginate with cursors or offsets                                | [`@xtandard/lib/pagination`](@BASE@/pagination/)          | nothing (or your query builder for an adapter)            |
| Filter lists from a UI, safely, on any database                 | [`@xtandard/lib/filters`](@BASE@/filters/) + an adapter   | `drizzle-orm` or `kysely` for those adapters; a validator |
| Keep typed state in the URL with TanStack Router                | [`@xtandard/lib/tanstack`](@BASE@/tanstack/)              | `react`, `@tanstack/react-router`                         |
| Use Temporal, ULIDs, DataLoader, unstorage, Sonner, React hooks | [Integrations](@BASE@/integrations/web/)                  | the library you're integrating                            |

The full list, with each entry's peers, is on [Entry points](@BASE@/guides/entry-points/).

## Optional peer dependencies

Every peer is listed in `peerDependenciesMeta` as optional, so your package manager won't install
them or warn about them. Import an entry point without its peer and you get a "module not found"
error at build time, which tells you exactly what to add:

```sh
# using @xtandard/lib/filters/drizzle and @xtandard/lib/filters/valibot
npm install drizzle-orm valibot @js-temporal/polyfill
```

:::tip[Frontend-safe entry points]
`@xtandard/lib`, `@xtandard/lib/filters`, `@xtandard/lib/pagination`, `@xtandard/lib/interval` and
`@xtandard/lib/tanstack/server` have no dependencies and no Node-only APIs, so you can share them
between your server and your frontend bundle. A common pattern is to share the filter model and its
URL codec with the browser, and keep the database adapters on the server.
:::

## TypeScript

The library is written in strict TypeScript and its types carry most of the documentation: hover
any export in your editor to read its JSDoc. The [API reference](@BASE@/api/) is generated from the
same source. Use `"moduleResolution": "bundler"` or `"node16"`/`"nodenext"` so the subpath exports
(`@xtandard/lib/filters/drizzle`, …) resolve.

## Versioning

`@xtandard/lib` stays on `0.x`, following standard semver within it: features and breaking
changes bump the minor version, fixes bump the patch. Breaking changes are always flagged in the
[changelog](@BASE@/project/changelog/). Because `^0.x` ranges accept new minors, pin an exact or
`~0.x` version if you want to opt in to breaking changes by hand.

## Where next

- Browse the [core utilities](@BASE@/core/).
- Follow a tutorial: [a filterable, paginated list](@BASE@/tutorials/filterable-list/).
- Play with the [filters](@BASE@/playground/filters/) and [interval](@BASE@/playground/interval/) playgrounds.
