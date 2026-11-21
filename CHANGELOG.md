# Changelog

## v0.7.0

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.6.0...v0.7.0)

### 🚀 Enhancements

- **filters:** @xtandard/lib/filters/memory — in-memory predicate, comparator and array pagination ([#17](https://github.com/xantiagoma/xtandard/pull/17))
- **interval:** IntervalSet and IntervalMap (Guava RangeSet / RangeMap) ([#18](https://github.com/xantiagoma/xtandard/pull/18))
- **filters:** Sql-tag adapter for Bun.sql and postgres.js (filters + pagination keyset) ([#19](https://github.com/xantiagoma/xtandard/pull/19))
- **filters:** TanStack Table bridge (@xtandard/lib/filters/tanstack-table) + table playground ([#23](https://github.com/xantiagoma/xtandard/pull/23))
- **filters:** PostgREST/Supabase and Elasticsearch/OpenSearch adapters ([#22](https://github.com/xantiagoma/xtandard/pull/22))
- **effect:** Support effect 4 via @xtandard/lib/effect/v4 and /filters/effect/v4 ([#26](https://github.com/xantiagoma/xtandard/pull/26))
- **brand:** Vector brand kit in the family system (logo, lockups, favicon set, social card) ([#30](https://github.com/xantiagoma/xtandard/pull/30))

### 🩹 Fixes

- **interval:** Difference keeps an included ±∞ on the extended line ([#21](https://github.com/xantiagoma/xtandard/pull/21))
- **site:** Serve og:url, og:image and sitemap URLs over https ([#28](https://github.com/xantiagoma/xtandard/pull/28))
- **interval:** Decimal and bignumber types under nodenext (+ dist consumer type check) ([#32](https://github.com/xantiagoma/xtandard/pull/32))
- **brand:** Centre the symbol vertically on the wordmark in the horizontal lockups ([#37](https://github.com/xantiagoma/xtandard/pull/37))

### 📖 Documentation

- The xtandard ecosystem ([#15](https://github.com/xantiagoma/xtandard/pull/15))
- **ecosystem:** Link the flags and webhooks docs sites ([#16](https://github.com/xantiagoma/xtandard/pull/16))
- **recs:** Make "Recommended libraries" a verified, generated catalog ([#20](https://github.com/xantiagoma/xtandard/pull/20))
- TypeScript 5.4+ for the drizzle-rqb and tanstack-table typings ([#33](https://github.com/xantiagoma/xtandard/pull/33))
- **ecosystem:** Add @xtandard/audit, @xtandard/links and @xtandard/entitlements ([#35](https://github.com/xantiagoma/xtandard/pull/35))
- **brand:** No tile on pages — stacked lockups for the home hero, symbol-light.svg ([#36](https://github.com/xantiagoma/xtandard/pull/36))

### 🏡 Chore

- Format CHANGELOG ([ff3918e](https://github.com/xantiagoma/xtandard/commit/ff3918e))
- **recs:** Drop deprecated picks, add successors, flag new-major prereleases ([#24](https://github.com/xantiagoma/xtandard/pull/24))
- **temporal:** Drop the unused itty-time peer ([#31](https://github.com/xantiagoma/xtandard/pull/31))
- **brand:** Show only SVG logos; drop the unused PNG variants ([#34](https://github.com/xantiagoma/xtandard/pull/34))

### 🤖 CI

- Publish to npm with trusted publishing (OIDC) ([#14](https://github.com/xantiagoma/xtandard/pull/14))

### ❤️ Contributors

- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))
- Santiago Montoya ([@xantiagoma](https://github.com/xantiagoma))

## v0.6.0

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.5.3...v0.6.0)

### 🩹 Fixes

- **core:** ⚠️ Completer.reset, AsyncChannel broadcast, isPromise, jaroWinkler, cursor dates ([019ee35](https://github.com/xantiagoma/xtandard/commit/019ee35))
- **filters:** ⚠️ ArkType node schema, LIKE escaping, MySQL quoting, RQB v1 arrays, strict sort ([f66dc2e](https://github.com/xantiagoma/xtandard/commit/f66dc2e))
- **tanstack:** ⚠️ Option precedence in useQueryStates, withTransport, duration equality ([33e3d80](https://github.com/xantiagoma/xtandard/commit/33e3d80))
- **react,sonner,web,unstorage:** ⚠️ ToastStreamAsync, StreamRenderer, useStream keys, interceptor, cache keys ([0d09deb](https://github.com/xantiagoma/xtandard/commit/0d09deb))

### 📖 Documentation

- Documentation site (Starlight) on GitHub Pages ([#11](https://github.com/xantiagoma/xtandard/pull/11))
- A summary and a verified example for every export ([#12](https://github.com/xantiagoma/xtandard/pull/12))

### 🏡 Chore

- **site:** Skip TypeDoc's type check of test-only imports ([e24cd41](https://github.com/xantiagoma/xtandard/commit/e24cd41))

### ✅ Tests

- Keep the node-only suites out of the browser project ([7f2f94b](https://github.com/xantiagoma/xtandard/commit/7f2f94b))

#### ⚠️ Breaking Changes

- **core:** ⚠️ Completer.reset, AsyncChannel broadcast, isPromise, jaroWinkler, cursor dates ([019ee35](https://github.com/xantiagoma/xtandard/commit/019ee35))
- **filters:** ⚠️ ArkType node schema, LIKE escaping, MySQL quoting, RQB v1 arrays, strict sort ([f66dc2e](https://github.com/xantiagoma/xtandard/commit/f66dc2e))
- **tanstack:** ⚠️ Option precedence in useQueryStates, withTransport, duration equality ([33e3d80](https://github.com/xantiagoma/xtandard/commit/33e3d80))
- **react,sonner,web,unstorage:** ⚠️ ToastStreamAsync, StreamRenderer, useStream keys, interceptor, cache keys ([0d09deb](https://github.com/xantiagoma/xtandard/commit/0d09deb))

### ❤️ Contributors

- Santiago Montoya ([@xantiagoma](https://github.com/xantiagoma))
- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))

## v0.5.3

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.5.2...v0.5.3)

### 🚀 Enhancements

- **filters:** KeepEmptyGroups opt-in on the compact URL decode ([#10](https://github.com/xantiagoma/xtandard/pull/10))

### ❤️ Contributors

- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))

## v0.5.2

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.5.1...v0.5.2)

### 🚀 Enhancements

- **filters,pagination:** Drizzle RQB adapters — v2 object + v1 callback ([#9](https://github.com/xantiagoma/xtandard/pull/9))

### ❤️ Contributors

- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))

## v0.5.1

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.5.0...v0.5.1)

### 🩹 Fixes

- **filters,pagination:** Widen drizzle-orm peer to v0.45 ∪ v1 incl 1.0.0-beta ([#8](https://github.com/xantiagoma/xtandard/pull/8))

### ❤️ Contributors

- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))

## v0.5.0

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.4.2...v0.5.0)

### 🚀 Enhancements

- **filters:** Portable core, per-driver adapters & multi-validator schemas ([#7](https://github.com/xantiagoma/xtandard/pull/7))

### ❤️ Contributors

- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))

## v0.4.2

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.4.0...v0.4.2)

### 📖 Documentation

- **releasing:** Document ZeroVer (no planned 1.0) + standard-semver policy ([#4](https://github.com/xantiagoma/xtandard/pull/4))

### 🏡 Chore

- Rename package + repo to xtandard ([#5](https://github.com/xantiagoma/xtandard/pull/5))
- **release:** V0.4.1 ([f859f4b](https://github.com/xantiagoma/xtandard/commit/f859f4b))
- Publish under @xtandard/lib scope ([#6](https://github.com/xantiagoma/xtandard/pull/6))

### ❤️ Contributors

- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))
- Santiago Montoya ([@xantiagoma](https://github.com/xantiagoma))

## v0.4.1

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.4.0...v0.4.1)

### 📖 Documentation

- **releasing:** Document ZeroVer (no planned 1.0) + standard-semver policy ([#4](https://github.com/xantiagoma/xtandard/pull/4))

### 🏡 Chore

- Rename package + repo to xtandard ([#5](https://github.com/xantiagoma/xtandard/pull/5))

### ❤️ Contributors

- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))

## v0.4.0

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.3.0...v0.4.0)

### 🚀 Enhancements

- **tanstack:** Nuqs-style URL query state for TanStack Router ([#2](https://github.com/xantiagoma/xtandard/pull/2))

### 📖 Documentation

- Format v0.3.0 changelog ([d81c71c](https://github.com/xantiagoma/xtandard/commit/d81c71c))

### ✅ Tests

- **interval,pagination:** Compile-time type tests via type-testing ([#3](https://github.com/xantiagoma/xtandard/pull/3))

### ❤️ Contributors

- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))
- Santiago Montoya ([@xantiagoma](https://github.com/xantiagoma))

## v0.3.0

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.2.1...v0.3.0)

### 🚀 Enhancements

- ⚠️ Generic Interval<T> with ordered domains + 8 new entry points ([#1](https://github.com/xantiagoma/xtandard/pull/1))

### 📖 Documentation

- Update v0.2.1 changelog ([5c5930a](https://github.com/xantiagoma/xtandard/commit/5c5930a))

#### ⚠️ Breaking Changes

- ⚠️ Generic Interval<T> with ordered domains + 8 new entry points ([#1](https://github.com/xantiagoma/xtandard/pull/1))

### ❤️ Contributors

- Santiago Montoya A. ([@xantiagoma](https://github.com/xantiagoma))
- Santiago Montoya ([@xantiagoma](https://github.com/xantiagoma))

## v0.2.1

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.2.0...v0.2.1)

### 🩹 Fixes

- Export toastStreamAsync from sonner entry ([19d0606](https://github.com/xantiagoma/xtandard/commit/19d0606))

### 📖 Documentation

- Document release process ([4bdd3f8](https://github.com/xantiagoma/xtandard/commit/4bdd3f8))
- Add toast stream TSDoc examples ([4338e57](https://github.com/xantiagoma/xtandard/commit/4338e57))

### ❤️ Contributors

- Santiago Montoya ([@xantiagoma](https://github.com/xantiagoma))

## v0.2.0

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.1.2...v0.2.0)

### 🚀 Enhancements

- Add pagination utilities ([d6eddcf](https://github.com/xantiagoma/xtandard/commit/d6eddcf))

### 🩹 Fixes

- Skip GitHub Release if already exists ([801bd43](https://github.com/xantiagoma/xtandard/commit/801bd43))

### ❤️ Contributors

- Santiago Montoya ([@xantiagoma](https://github.com/xantiagoma))

## v0.1.2

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.1.1...v0.1.2)

### 🚀 Enhancements

- Add usePreventAutoFocus hook to xtandard/react ([1b3fc18](https://github.com/xantiagoma/xtandard/commit/1b3fc18))
- Add createHttpInterceptor to xtandard/web ([9b71af7](https://github.com/xantiagoma/xtandard/commit/9b71af7))
- Add useDynamicRefs hook + createHttpInterceptor + README with source links ([d7d9901](https://github.com/xantiagoma/xtandard/commit/d7d9901))

### 🩹 Fixes

- Suppress browser open on release (--no-open) ([b3563bd](https://github.com/xantiagoma/xtandard/commit/b3563bd))

### ❤️ Contributors

- Santiago Montoya ([@xantiagoma](https://github.com/xantiagoma))

## v0.1.1

[compare changes](https://github.com/xantiagoma/xtandard/compare/v0.1.0...v0.1.1)

### 🚀 Enhancements

- Add Providers + provider() to xtandard/react ([02df996](https://github.com/xantiagoma/xtandard/commit/02df996))

### 📖 Documentation

- Expand recommended libraries from starred repos ([fc50883](https://github.com/xantiagoma/xtandard/commit/fc50883))
- Add more recommended libraries ([2290343](https://github.com/xantiagoma/xtandard/commit/2290343))
- Add dexie ([3398198](https://github.com/xantiagoma/xtandard/commit/3398198))

### ❤️ Contributors

- Santiago Montoya ([@xantiagoma](https://github.com/xantiagoma))
