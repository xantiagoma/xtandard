<p align="center">
  <img src="./assets/logo.png" alt="xantiagoma" width="120" />
</p>

<h1 align="center">xantiagoma</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/xantiagoma"><img src="https://img.shields.io/npm/v/xantiagoma?color=blue" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/xantiagoma"><img src="https://img.shields.io/npm/dm/xantiagoma" alt="npm downloads" /></a>
  <a href="https://github.com/xantiagoma/xantiagoma-lib/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/xantiagoma" alt="license" /></a>
</p>

A collection of lightweight, type-safe utilities for TypeScript/JavaScript.

## Install

```bash
npm install xantiagoma
# or
bun add xantiagoma
# or
pnpm add xantiagoma
```

## Utilities

| Utility                     | Description                                                    | Docs                       |
| --------------------------- | -------------------------------------------------------------- | -------------------------- |
| `tryCatch` / `tryCatchSync` | Convert promises or sync functions into `[data, error]` tuples | [docs](./src/try-catch.ts) |

## Quick Examples

```ts
import { tryCatch, tryCatchSync } from "xantiagoma";

const [user, error] = await tryCatch(fetch("/api/me").then((r) => r.json()));

const [parsed, err] = tryCatchSync(() => JSON.parse(rawString));
```

## See Also

- [drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor) — Cursor-based pagination for Drizzle ORM
- [drizzle-audit](https://github.com/xantiagoma/drizzle-audit) — Configurable audit logging for Drizzle ORM

## License

MIT
