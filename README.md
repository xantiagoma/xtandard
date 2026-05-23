# xantiagoma

Personal utilities by [Santiago Montoya](https://github.com/xantiagoma).

## Install

```bash
npm install xantiagoma
```

## `tryCatch` / `tryCatchSync`

Convert promises or sync functions into `[data, error]` tuples — no `try/catch` needed.

```ts
import { tryCatch, tryCatchSync } from "xantiagoma";

// Async
const [user, error] = await tryCatch(fetch("/api/me").then((r) => r.json()));
if (error) {
  // handle error
}

// With async function
const [data, err] = await tryCatch(async () => {
  const res = await fetch("/api/data");
  return res.json();
});

// Sync
const [parsed, parseErr] = tryCatchSync(() => JSON.parse(rawString));
```

## See Also

- [drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor) — Cursor-based pagination for Drizzle ORM
- [drizzle-audit](https://github.com/xantiagoma/drizzle-audit) — Configurable audit logging for Drizzle ORM

## License

MIT
