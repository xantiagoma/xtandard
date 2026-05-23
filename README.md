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
| `xantiagoma/react`      | StreamRenderer + useStream hook        | `react`, `@tanstack/react-query` |

Sub-entry dependencies are **optional peer deps** — only install what you use.

## Core Utilities (`xantiagoma`)

### Error Handling

| Export                       | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| `tryCatch(promise)`          | Async `[data, error]` tuple — no try/catch needed |
| `tryCatchSync(fn)`           | Sync `[data, error]` tuple                        |
| `assertNotNull(value)`       | Throws if null/undefined, narrows type            |
| `valueOrThrow(value, error)` | Returns value or throws                           |
| `AssertError`                | Custom error class for assertions                 |

### Async

| Export                       | Description                               |
| ---------------------------- | ----------------------------------------- |
| `wait(ms)`                   | Typed setTimeout delay                    |
| `Completer`                  | Externally resolvable Promise (like Dart) |
| `collect(iterable)`          | Drain `AsyncIterable<T>` into `T[]`       |
| `asyncOf(...values)`         | Create `AsyncGenerator` from values       |
| `AsyncChannel`               | Push-based `AsyncIterable` with modes     |
| `resolveMaybePromise(value)` | Resolve `T \| Promise<T>` → `Promise<T>`  |

### Iterables & Generators

| Export                         | Description                                |
| ------------------------------ | ------------------------------------------ |
| `range(start, end, step?)`     | Numeric range as array                     |
| `rangeLazy(start, end, step?)` | Numeric range as generator                 |
| `enumerate(iterable)`          | `[index, value]` tuples (sync)             |
| `enumerateAsync(iterable)`     | `[index, value]` tuples (async)            |
| `toIterator(iterable)`         | Normalize to `Iterator`                    |
| `toAsyncIterable(source)`      | Normalize any iterable to `AsyncGenerator` |

### Type Guards

| Export                     | Description                                 |
| -------------------------- | ------------------------------------------- |
| `isPromise(value)`         | Check for promise-like                      |
| `isIterable(value)`        | Check for `Iterable`                        |
| `isAsyncIterable(value)`   | Check for `AsyncIterable`                   |
| `isIterator(value)`        | Check for `Iterator`                        |
| `isGenerator(value)`       | Check for `Generator`                       |
| `isAsyncGenerator(value)`  | Check for `AsyncGenerator`                  |
| `isDisposable(value)`      | Check for `Disposable` or `AsyncDisposable` |
| `isAsyncDisposable(value)` | Check for `AsyncDisposable`                 |
| `isSyncDisposable(value)`  | Check for `Disposable`                      |

### Disposable Utilities

| Export                | Description                             |
| --------------------- | --------------------------------------- |
| `defer(fn)`           | Cancellable `await using` disposable    |
| `deferSync(fn)`       | Cancellable `using` disposable          |
| `makeDisposable(obj)` | Add `Symbol.asyncDispose` to any object |

### Strings

| Export                      | Description                   |
| --------------------------- | ----------------------------- |
| `ensureString(value)`       | Coerce to string              |
| `naturalSortCompare(a, b)`  | Natural sort comparator       |
| `jaroWinklerDistance(a, b)` | Fuzzy string similarity (0-1) |

### Misc

| Export                                      | Description                             |
| ------------------------------------------- | --------------------------------------- |
| `cast<T>(value)`                            | Unsafe `as T` type cast                 |
| `log(value)`                                | `console.log` that returns its argument |
| `prepareLoaderResult(rows, keys)`           | Map DB rows to DataLoader key order     |
| `resolveStreamSource(source)`               | Resolve `StreamSource<T>`               |
| `secondsToMs` / `minutesToMs` / `hoursToMs` | Time unit converters                    |

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

## See Also

- [drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor) — Cursor-based pagination for Drizzle ORM
- [drizzle-audit](https://github.com/xantiagoma/drizzle-audit) — Configurable audit logging for Drizzle ORM

## License

MIT
