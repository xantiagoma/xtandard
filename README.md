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

## Entry Points

| Import                  | Description                            | Dependencies                     |
| ----------------------- | -------------------------------------- | -------------------------------- |
| `xantiagoma`            | Core utilities (isomorphic, zero deps) | none                             |
| `xantiagoma/web`        | Browser/FormData utilities             | none                             |
| `xantiagoma/ulid`       | Prefixed ULID generation + helpers     | `ulid`                           |
| `xantiagoma/temporal`   | Date/time/duration with Temporal API   | `temporal-polyfill`, `itty-time` |
| `xantiagoma/dataloader` | DataLoader factory                     | `dataloader`                     |
| `xantiagoma/unstorage`  | Cache helpers with unstorage           | `unstorage`, `ohash`             |
| `xantiagoma/valibot`    | TimeZone validation schema             | `valibot`                        |
| `xantiagoma/sonner`     | Toast streaming for iterables          | `sonner`, `react`                |
| `xantiagoma/react`      | React hooks + components               | `react`, `@tanstack/react-query` |

Sub-entry dependencies are **optional peer deps** — only install what you use.

## Core Utilities (`xantiagoma`)

### Error Handling

| Export                      | Description                            | Source                          | Tests                                   |
| --------------------------- | -------------------------------------- | ------------------------------- | --------------------------------------- |
| `tryCatch` / `tryCatchSync` | `[data, error]` tuples — no try/catch  | [src](./src/try-catch.ts)       | [tests](./test/try-catch.test.ts)       |
| `assertNotNull`             | Throws if null/undefined, narrows type | [src](./src/assert-not-null.ts) | [tests](./test/assert-not-null.test.ts) |
| `valueOrThrow`              | Returns value or throws                | [src](./src/error.ts)           | [tests](./test/error.test.ts)           |
| `AssertError`               | Custom error class                     | [src](./src/errors.ts)          | [tests](./test/errors.test.ts)          |

### Async

| Export                | Description                              | Source                                | Tests                                         |
| --------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `wait`                | Typed setTimeout delay                   | [src](./src/wait.ts)                  | [tests](./test/wait.test.ts)                  |
| `Completer`           | Externally resolvable Promise            | [src](./src/completer.ts)             | [tests](./test/completer.test.ts)             |
| `collect`             | Drain `AsyncIterable<T>` into `T[]`      | [src](./src/collect.ts)               | [tests](./test/collect.test.ts)               |
| `asyncOf`             | Create `AsyncGenerator` from values      | [src](./src/async-of.ts)              | [tests](./test/async-of.test.ts)              |
| `AsyncChannel`        | Push-based `AsyncIterable` with modes    | [src](./src/async-channel.ts)         | [tests](./test/async-channel.test.ts)         |
| `resolveMaybePromise` | Resolve `T \| Promise<T>` → `Promise<T>` | [src](./src/resolve-maybe-promise.ts) | [tests](./test/resolve-maybe-promise.test.ts) |

### Iterables & Generators

| Export                         | Description                       | Source                            | Tests                                     |
| ------------------------------ | --------------------------------- | --------------------------------- | ----------------------------------------- |
| `range` / `rangeLazy`          | Numeric range (array / generator) | [src](./src/range.ts)             | [tests](./test/range.test.ts)             |
| `enumerate` / `enumerateAsync` | `[index, value]` tuples           | [src](./src/enumerate.ts)         | [tests](./test/enumerate.test.ts)         |
| `toIterator`                   | Normalize to `Iterator`           | [src](./src/to-iterator.ts)       | [tests](./test/to-iterator.test.ts)       |
| `toAsyncIterable`              | Normalize to `AsyncGenerator`     | [src](./src/to-async-iterable.ts) | [tests](./test/to-async-iterable.test.ts) |

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

## Web Utilities (`xantiagoma/web`)

| Export                  | Description                         | Source                                    | Tests                                       |
| ----------------------- | ----------------------------------- | ----------------------------------------- | ------------------------------------------- |
| `formDataToObject`      | `FormData` → plain object           | [src](./src/form-data-to-object-utils.ts) | [tests](./test/form-data-to-object.test.ts) |
| `fetchWithProgress`     | Fetch with upload/download progress | [src](./src/fetch-with-progress.ts)       | [tests](./test/fetch-with-progress.test.ts) |
| `createHttpInterceptor` | Intercept fetch + XHR with rules    | [src](./src/intercept-http.ts)            | [tests](./test/intercept-http.test.tsx)     |

## React Utilities (`xantiagoma/react`)

| Export                         | Description                         | Source                                 | Tests                                           |
| ------------------------------ | ----------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `Providers` / `provider`       | Compose providers without nesting   | [src](./src/providers.tsx)             | [tests](./test/providers.test.tsx)              |
| `usePreventAutoFocus`          | Prevent auto-focus in modals        | [src](./src/use-prevent-auto-focus.ts) | [tests](./test/use-prevent-auto-focus.test.tsx) |
| `useDynamicRefs`               | Dynamic ref registry by key         | [src](./src/use-dynamic-refs.ts)       | [tests](./test/use-dynamic-refs.test.tsx)       |
| `useStream` / `StreamRenderer` | Stream consumption hook + component | [src](./src/stream-renderer.tsx)       | [tests](./test/stream-renderer.test.tsx)        |

## Recommended Libraries

These are libraries we use and recommend. They're not re-exported — install them directly:

| Library                                                                    | Description                         |
| -------------------------------------------------------------------------- | ----------------------------------- |
| [es-toolkit](https://github.com/toss/es-toolkit)                           | Modern lodash alternative           |
| [ohash](https://github.com/unjs/ohash)                                     | Object hashing                      |
| [unstorage](https://github.com/unjs/unstorage)                             | Universal key-value storage         |
| [cockatiel](https://github.com/connor4312/cockatiel)                       | Retry / circuit breaker / bulkhead  |
| [chroma-js](https://github.com/gka/chroma.js)                              | Color manipulation                  |
| [xbytes](https://github.com/Zak-Olyarnik/xbytes)                           | Byte size formatting                |
| [etiket](https://github.com/nicholasgasior/etiket)                         | Barcode generation                  |
| [portakal](https://www.npmjs.com/package/portakal)                         | Printer / ESC/POS                   |
| [hucre](https://www.npmjs.com/package/hucre)                               | Spreadsheet utilities               |
| [@gobrand/tiempo](https://www.npmjs.com/package/@gobrand/tiempo)           | Time formatting / parsing           |
| [tactus](https://www.npmjs.com/package/tactus)                             | Haptic feedback for web             |
| [liveline](https://www.npmjs.com/package/liveline)                         | Animated line charts (React)        |
| [react-lzy-img](https://www.npmjs.com/package/react-lzy-img)               | Lazy loading images (React)         |
| [masonic](https://github.com/jaredLunde/masonic)                           | Virtualized masonry layout (React)  |
| [p-map](https://github.com/sindresorhus/p-map)                             | Concurrent async mapping            |
| [motion](https://motion.dev/)                                              | Animation library (React)           |
| [tailwind-merge](https://github.com/dcastil/tailwind-merge)                | Merge Tailwind classes              |
| [lucide-react](https://lucide.dev/)                                        | Icon library (React)                |
| [jotai](https://jotai.org/)                                                | Atomic state management (React)     |
| [permix](https://www.npmjs.com/package/permix)                             | Permission management               |
| [std-env](https://github.com/unjs/std-env)                                 | Runtime environment detection       |
| [ufo](https://github.com/unjs/ufo)                                         | URL utilities                       |
| [@total-typescript/ts-reset](https://github.com/total-typescript/ts-reset) | Stricter TypeScript defaults        |
| [better-auth](https://www.better-auth.com/)                                | Authentication framework            |
| [drizzle-orm](https://orm.drizzle.team/)                                   | TypeScript ORM                      |
| [drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor)             | Cursor-based pagination for Drizzle |
| [drizzle-audit](https://github.com/xantiagoma/drizzle-audit)               | Audit logging for Drizzle           |
| [elysia](https://elysiajs.com/)                                            | Bun-first web framework             |
| [hono](https://hono.dev/)                                                  | Lightweight web framework           |
| [inngest](https://www.inngest.com/)                                        | Background jobs + durable functions |
| [stripe](https://stripe.com/)                                              | Payment processing                  |
| [paykit](https://github.com/getpaykit/paykit)                              | Payment toolkit for Stripe          |
| [@tanstack/react-query](https://tanstack.com/query)                        | Async state management (React)      |
| [@tanstack/react-table](https://tanstack.com/table)                        | Headless table (React)              |
| [@tanstack/react-form](https://tanstack.com/form)                          | Form management (React)             |
| [@tanstack/react-virtual](https://tanstack.com/virtual)                    | Virtualized lists (React)           |
| [ai](https://sdk.vercel.ai/)                                               | Vercel AI SDK                       |
| [graphql-yoga](https://the-guild.dev/graphql/yoga-server)                  | GraphQL server                      |
| [pothos](https://pothos-graphql.dev/)                                      | GraphQL schema builder              |
| [react-router](https://reactrouter.com/)                                   | Routing (React)                     |
| [class-variance-authority](https://cva.style/)                             | Component variant classes           |
| [clsx](https://github.com/lukeed/clsx)                                     | Conditional classnames              |
| [next-themes](https://github.com/pacocoursey/next-themes)                  | Theme management (React)            |
| [react-email](https://react.email/)                                        | Email templates (React)             |
| [@uppy/core](https://uppy.io/)                                             | File upload                         |
| [dotenv](https://github.com/motdotla/dotenv)                               | Environment variables               |
| [citty](https://github.com/unjs/citty)                                     | CLI framework                       |
| [evlog](https://www.npmjs.com/package/evlog)                               | Event logging                       |
| [@electric-sql/pglite](https://pglite.dev/)                                | In-memory PostgreSQL                |
| [neverthrow](https://github.com/supermacro/neverthrow)                     | Type-safe Result type               |
| [ts-pattern](https://github.com/gvergnaud/ts-pattern)                      | Exhaustive pattern matching         |
| [nanoid](https://github.com/ai/nanoid)                                     | Tiny unique ID generator            |
| [superjson](https://github.com/flightcontrolhq/superjson)                  | Serialize Date, Map, Set via JSON   |
| [destr](https://github.com/unjs/destr)                                     | Safe, fast JSON.parse alternative   |
| [dequal](https://github.com/lukeed/dequal)                                 | Tiny deep equality check            |
| [klona](https://github.com/lukeed/klona)                                   | Tiny deep clone                     |
| [mutative](https://github.com/unadlib/mutative)                            | Fast immutable updates (like Immer) |
| [ofetch](https://github.com/unjs/ofetch)                                   | Better fetch with retries + parsing |
| [ky](https://github.com/sindresorhus/ky)                                   | Tiny fetch-based HTTP client        |
| [consola](https://github.com/unjs/consola)                                 | Elegant structured logger           |
| [p-queue](https://github.com/sindresorhus/p-queue)                         | Promise queue with concurrency      |
| [croner](https://github.com/Hexagon/croner)                                | Cron scheduler (Node + browser)     |
| [oslo](https://github.com/pilcrowonpaper/oslo)                             | Auth utilities (TOTP, JWT, hashing) |
| [arctic](https://github.com/pilcrowonpaper/arctic)                         | OAuth 2.0 provider integrations     |
| [casl](https://github.com/stalniy/casl)                                    | Isomorphic authorization            |
| [unctx](https://github.com/unjs/unctx)                                     | Composables via AsyncLocalStorage   |
| [execa](https://github.com/sindresorhus/execa)                             | Better child_process                |
| [knip](https://github.com/webpro-nl/knip)                                  | Find unused code + dependencies     |
| [clack](https://github.com/bombshell-dev/clack)                            | Beautiful CLI prompts + spinners    |
| [sonner](https://github.com/emilkowalski/sonner)                           | Toast notifications (React)         |
| [vaul](https://github.com/emilkowalski/vaul)                               | Drawer component (React)            |
| [cmdk](https://github.com/pacocoursey/cmdk)                                | Command menu (React)                |
| [embla-carousel](https://github.com/davidjerleke/embla-carousel)           | Lightweight carousel                |
| [dnd-kit](https://github.com/clauderic/dnd-kit)                            | Drag and drop toolkit (React)       |
| [nuqs](https://github.com/47ng/nuqs)                                       | Type-safe URL search params (React) |
| [react-error-boundary](https://github.com/bvaughn/react-error-boundary)    | Error boundary component (React)    |
| [react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook) | Keyboard shortcuts hook (React)     |
| [auto-animate](https://github.com/formkit/auto-animate)                    | Zero-config DOM animations          |
| [satori](https://github.com/vercel/satori)                                 | JSX/HTML to SVG (OG images)         |
| [orama](https://github.com/oramasearch/orama)                              | In-memory full-text + vector search |
| [gql.tada](https://github.com/0no-co/gql.tada)                             | Typed GraphQL documents at compile  |
| [kysely](https://github.com/kysely-org/kysely)                             | Type-safe SQL query builder         |
| [currency.js](https://github.com/scurker/currency.js)                      | Safe currency arithmetic            |
| [thumbhash](https://github.com/evanw/thumbhash)                            | Image placeholder algorithm         |
| [noble-hashes](https://github.com/paulmillr/noble-hashes)                  | Audited crypto hashes (pure TS)     |
| [better-all](https://github.com/shuding/better-all)                        | Better Promise.all with named keys  |
| [better-result](https://github.com/dmmulroy/better-result)                 | Rust-like Result type for TS        |
| [fuse.js](https://www.fusejs.io/)                                          | Lightweight fuzzy search            |
| [files-sdk](https://github.com/haydenbleasel/files-sdk)                    | Unified file storage SDK            |
| [streamdown](https://github.com/vercel/streamdown)                         | Stream Markdown rendering           |
| [ai-elements](https://github.com/vercel/ai-elements)                       | AI-powered UI components            |
| [tiptap](https://tiptap.dev/)                                              | Headless rich text editor           |
| [better-notify](https://github.com/better-notify/better-notify)            | Notification management             |
| [@vercel/chat](https://github.com/vercel/chat)                             | Chat UI components                  |
| [@vercel/workflow](https://github.com/vercel/workflow)                     | Durable workflow engine             |
| [trigger.dev](https://trigger.dev/)                                        | Background jobs platform            |
| [temporal](https://temporal.io/)                                           | Durable workflow orchestration      |
| [@vercel/sandbox](https://github.com/vercel/sandbox)                       | Code sandbox execution              |
| [reactflow](https://reactflow.dev/)                                        | Node-based graph editor (React)     |
| [date-fns](https://date-fns.org/)                                          | Modern date utility library         |
| [cheerio](https://cheerio.js.org/)                                         | Fast HTML parsing + manipulation    |
| [dexie](https://dexie.org/)                                                | IndexedDB wrapper with clean API    |

## See Also

- [drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor) — Cursor-based pagination for Drizzle ORM
- [drizzle-audit](https://github.com/xantiagoma/drizzle-audit) — Configurable audit logging for Drizzle ORM

## License

MIT
