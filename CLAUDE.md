# xtandard

Lightweight, type-safe TypeScript utilities with zero deps for the core.

## Tooling

- **Package manager**: Bun (`bun install`, `bun run <script>`)
- **Toolchain**: Vite+ (`vp`) — test, lint, fmt, build
- **TypeScript**: the toolchain stays on 5.9 (`typescript` devDep; tsdown's `.d.ts` build needs the JS compiler API, which TypeScript 7 doesn't ship). The `typescript-v7` alias devDep type-checks the repo with TypeScript 7 so the `^5 || ^6 || ^7` peer stays honest. The `filters/drizzle-rqb` and `filters/tanstack-table` typings use `NoInfer` and need TS 5.4+ (documented, peer not narrowed).
- **Node**: Managed via mise (requires >= 22.18.0 for TS config support)

## Scripts

- `bun run test` — run tests (vitest via `vp test run`, node + browser projects)
- `bun run test:coverage` — tests with v8 coverage report
- `bun run test:coverage:open` — same + opens in browser
- `bun run lint` — lint (oxlint via `vp lint`)
- `bun run format` — format (oxfmt via `vp fmt`)
- `bun run check` — lint + format check + typecheck (TypeScript 5.9 `tsc`, then TypeScript 7 via `bun run typecheck:ts7`)
- `bun run build` — build library (tsdown via `vp pack`, outputs CJS + ESM + DTS to `dist/`), then `scripts/check-dist.ts` and `scripts/check-dist-types.ts` (type-checks every subpath's `.d.mts`/`.d.cts` as a `nodenext` consumer, ESM + CJS)
- `bun run release` — bump version, update changelog, tag, push (CI publishes)
- `bun run docs:dev` / `docs:build` / `docs:preview` — the docs site (see below)

## Docs Site

`site/` is an Astro Starlight site (own `package.json`/lockfile, not published) deployed by
`.github/workflows/pages.yml` to https://me.xantiagoma.com/xtandard/.

- `README.md` and `docs/*.md` stay the source of truth (they render on GitHub/npm).
  `site/scripts/sync.ts` copies them into `site/src/content/docs/` (generated, gitignored),
  splitting long guides into pages by H2 per `site/manifest.ts` — so **renaming an H2 in
  `docs/*.md` needs the matching `site/manifest.ts` entry updated** (sync fails loudly otherwise).
- Site-only pages (core, integrations, tutorials, playgrounds) live in `site/content/`.
- The API reference is generated from `src/` by starlight-typedoc; each `src/entry-*.ts` (and
  `src/index.ts`) starts with a `@module` doc comment that names and describes its page.
  `site/scripts/api-overviews.ts` writes `/api/` and `/api/<module>/` overview pages.
- Playgrounds are React islands in `site/src/components/` importing the library from source.
- Astro runs under Bun (`bun --bun astro …`); `.mdx` is excluded from `vp fmt` (oxfmt mangles MDX).

## Recommended Libraries

`recs/libraries.ts` (typed by `recs/schema.ts`) is the single source of truth for the README
"Recommended Libraries" section (between `<!-- recs:start -->`/`<!-- recs:end -->`, written by
`bun run recs:generate`; `bun run check` and CI fail when it is stale) and the site page
`site/content/project/recommended-libraries.mdx` (React island `RecommendedLibraries.tsx`).
`bun run recs:check` queries npm + GitHub, writes `recs/status.json`, and flags deprecated,
archived, abandoned or relicensed packages. Criteria and steps: `docs/RECOMMENDING.md`.

## Release Process

See `docs/RELEASING.md` before releasing. For planned pre-1.0 minor releases,
use an explicit version (`bunx changelogen --release -r 0.2.0 --push --no-open`)
instead of `--minor`; changelogen may otherwise bump `0.1.2` to `0.1.3`.

## Config

All tool configuration lives in `vite.config.ts` (vite-plus unified config).
Do NOT create separate config files for vitest, oxlint, or oxfmt.

## Testing

- Import from `vitest`, not `bun:test`
- Node tests: `test/**/*.test.ts` — run in node environment with MSW for HTTP mocking
- React/browser tests: `test/**/*.test.tsx` — run in Chromium via playwright + vitest-browser-react
- MSW setup in `test/setup-msw.ts` (node project only)
- Real Postgres without Docker: `startPglite()` in `test/sql-tag-helpers.ts` (PGlite + pglite-socket,
  in-process, driven by postgres.js); such suites go in the browser project's `exclude`
- Type tests: `test/*.test-d.ts` — compile-time assertions with `type-testing` (`Expect`/`Equal`/`NotEqual`/`IsNever`/`IsUnion`…), the standard for any module whose public type inference matters. They are NOT run by the test runner (the `.test-d.ts` suffix is excluded from the vitest `include`); they are enforced by `tsc --noEmit` (and the TypeScript 7 `typecheck:ts7`) in `bun run check`. `export` each assertion so it doesn't trip unused-decl lint; a wrong assertion fails as `error TS2344: Type 'false' does not satisfy the constraint 'true'`.

## Entry Points

```
@xtandard/lib              → isomorphic core (zero deps)
@xtandard/lib/interval     → generic Interval<T> + number/integer/bigint/Date/string domains + createOrdinalInterval + IntervalSet/IntervalMap (Guava Range/DiscreteDomain/RangeSet/RangeMap, zero deps)
@xtandard/lib/dinero       → money intervals (Interval of dinero.js values) (peer: dinero.js)
@xtandard/lib/decimal      → exact-decimal intervals (Interval of decimal.js values) (peer: decimal.js)
@xtandard/lib/big          → exact-decimal intervals (Interval of big.js values) (peer: big.js)
@xtandard/lib/bignumber    → exact-decimal intervals (Interval of bignumber.js values) (peer: bignumber.js)
@xtandard/lib/fraction     → exact-rational intervals (Interval of fraction.js values) (peer: fraction.js)
@xtandard/lib/semver       → semantic-version range intervals (peer: semver)
@xtandard/lib/ip           → IPv4/IPv6 address & CIDR intervals (peer: ipaddr.js)
@xtandard/lib/pagination   → pagination, keyset helpers + raw SQL adapters
@xtandard/lib/filters      → filter model (TS types) + portable compileFilters→CompiledWhere AST + sort/describe (zero deps; validation-lib-free; FE-safe)
@xtandard/lib/filters/valibot → optional valibot schemas for the model (peer: valibot, @js-temporal/polyfill)
@xtandard/lib/filters/drizzle → renders the AST to Drizzle WHERE + keyset (peer: drizzle-orm); date resolveDate INJECTED
@xtandard/lib/filters/kysely  → renders the AST to a Kysely boolean expr (peer: kysely)
@xtandard/lib/filters/knex    → renders the AST to raw parameterized SQL (no driver dep)
@xtandard/lib/filters/sql-tag → renders the AST to Bun.sql / postgres.js fragments (structural `sql`, no driver dep)
@xtandard/lib/filters/mongo   → renders the AST to a Mongo filter object (no driver dep)
@xtandard/lib/filters/prisma  → renders the AST to a Prisma where object (no driver dep)
@xtandard/lib/filters/memory  → evaluates the AST in memory: (row) => boolean with SQL semantics + sort comparator + sync array pagination (zero deps)
@xtandard/lib/filters/tanstack-table → TanStack Table state (columnFilters/globalFilter/sorting/pagination) ⇄ model/Sort/pagination + cursor stack (zero deps; structural types = table-core v8 & v9)
@xtandard/lib/filters/postgrest → renders the AST to PostgREST/Supabase query params + order/keyset (no driver dep)
@xtandard/lib/filters/elasticsearch → renders the AST to an Elasticsearch/OpenSearch Query DSL clause + sort/search_after keyset (no client dep)
@xtandard/lib/web          → browser/FormData + fetchWithProgress + keepSubDelims (peer: up-fetch)
@xtandard/lib/tanstack     → nuqs-style URL query state for TanStack Router (peer: react, @tanstack/react-router)
@xtandard/lib/tanstack/server   → framework-free parsers/serializer/loader/standard-schema (zero deps)
@xtandard/lib/tanstack/testing  → headless QueryStateTestingAdapter (peer: react)
@xtandard/lib/tanstack/temporal → URL parsers for the six Temporal kinds (peer: @js-temporal/polyfill, valibot)
@xtandard/lib/tanstack/rison    → risonCodec for parseAsCodec (peer: @effective/rison, valibot)
@xtandard/lib/react        → StreamRenderer, useStream (peer: react, @tanstack/react-query)
@xtandard/lib/sonner       → toastStream (peer: sonner, react)
@xtandard/lib/ulid         → ULID generation + helpers (peer: ulid)
@xtandard/lib/temporal     → datetime + duration + Temporal interval types (peer: @js-temporal/polyfill)
@xtandard/lib/dataloader   → createLoader factory (peer: dataloader)
@xtandard/lib/unstorage    → withCache, createCache (peer: unstorage, ohash)
@xtandard/lib/valibot      → TimeZone validation (peer: valibot)
@xtandard/lib/effect       → TimeZone schema on effect 3 (peer: effect ^3)
@xtandard/lib/effect/v4    → same on effect 4 (peer: effect ^4; src/*-v4.ts import the `effect-v4` dev alias, remapped to `effect` by the build; filters/effect/v4 likewise)
```

All sub-entry deps are optional peer dependencies.

## Project Structure

```
src/
  index.ts              — main barrel (isomorphic, zero deps)
  entry-web.ts          — web entry point
  entry-react.ts        — React entry point
  entry-sonner.ts       — sonner entry point
  entry-ulid.ts         — ulid entry point
  entry-temporal.ts     — temporal entry point
  entry-dataloader.ts   — dataloader entry point
  entry-unstorage.ts    — unstorage entry point
  entry-valibot.ts      — valibot entry point
  entry-tanstack*.ts    — TanStack entry points (root, -server, -testing, -temporal, -rison)
  tanstack/             — query-params module (core/, react/, adapters/, temporal.ts, rison.ts)
                          — the one nested module; entries above are flat barrels into it
  types.ts              — shared types (MaybePromise)
  try-catch.ts, wait.ts, range.ts, ...  — individual utils
  *-utils.ts            — dep-based implementations (renamed to avoid entry conflicts)
test/
  *.test.ts             — node tests (vitest)
  *.test.tsx            — browser tests (vitest-browser-react + playwright)
  *.test-d.ts           — type tests (type-testing; checked by tsc, not the runner)
  setup-msw.ts          — MSW server setup for node tests
```

## Key Patterns

- Entry files named `entry-*.ts` to avoid conflicts with implementation files
- Dep-based implementations named `*-utils.ts` (e.g. `ulid-utils.ts`)
- `up-fetch` captured lazily (not at import time) so MSW can intercept
- Browser tests use `vitest-browser-react` with `vite-plus/test/browser-playwright`
- All optional peer deps in `peerDependenciesMeta` with `optional: true`
- Factories/combinators that accept user callbacks are sync/async-adaptive
  (all-sync inputs → sync results, typed via overloads; see
  `docs/sync-async-adaptive.md` for the full pattern: rules, recipes, testing
  checklist). Used by `createCursorCodec`, `createPaginator`, `tryCatch`,
  `collect`, `enumerate`. Structural-protocol variants stay explicit
  (`defer`/`deferSync` — `await using` vs `using`)
