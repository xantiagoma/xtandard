---
title: "unstorage"
description: "Cache async function results in any unstorage driver (memory, Redis, filesystem…) with a TTL, as a wrapper or a class-method decorator."
---

`@xtandard/lib/unstorage` caches the results of async functions in an [unstorage](https://unstorage.unjs.io/) `Storage`, so the same code can cache in memory during development and in Redis, Cloudflare KV or a database in production. Use it for slow, mostly-stable lookups: third-party API calls, expensive queries, computed reports.

```sh
npm install @xtandard/lib unstorage ohash
```

```ts
import { withCache, createCache } from "@xtandard/lib/unstorage";
```

`unstorage` (v1) and `ohash` (v2, used to hash arguments into keys) are optional peer dependencies.

## `withCache`: wrap one function

```ts
import { createStorage } from "unstorage";
import redisDriver from "unstorage/drivers/redis";
import { withCache } from "@xtandard/lib/unstorage";

const storage = createStorage({ driver: redisDriver({ base: "app" }) });

const getRates = withCache(async (base: string, date: string) => fx.fetchRates(base, date), {
  storage,
  prefix: "fx",
  ttl: 3600,
});

await getRates("USD", "2026-11-19"); // calls fx.fetchRates, stores the result
await getRates("USD", "2026-11-19"); // served from storage
await getRates("EUR", "2026-11-19"); // different args → different entry
```

The wrapped function has the same signature as the original. On a hit it returns the stored value; on a miss it calls the function and stores the result.

### Options (`WithCacheOptions`)

| Option    | Description                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------- |
| `storage` | Any unstorage `Storage`. Required.                                                              |
| `prefix`  | Scopes keys with unstorage's `prefixStorage`: entries live under `prefix:` + key.               |
| `ttl`     | Time to live in **seconds**. Omit to keep entries until removed.                                |
| `toKey`   | `(...args) => string`. Defaults to `hash(args)` from ohash, a stable hash of all the arguments. |

Pass `toKey` when you want readable keys you can invalidate by hand, or when some arguments shouldn't affect the cache:

```ts
const search = withCache(async (query: string, page: number) => api.search(query, page), {
  storage,
  prefix: "search",
  ttl: 300,
  toKey: (query, page) => `${query}:${page}`,
});

await search("hello", 2);
await storage.removeItem("search:hello:2"); // invalidate that one entry
```

### How TTL works

The TTL is applied twice. It is passed to the driver as `{ ttl }`, so drivers with native expiry (Redis, for example) drop the entry themselves. It is also stored with the value as an `expiresAt` timestamp, and an entry read after that time is deleted and treated as a miss, so expiry also works on drivers that ignore `ttl` (memory, filesystem). Entries are stored as `{ value, expiresAt }`, not as the bare value: read them through the cache rather than with `storage.getItem`.

:::caution[Things the cache does not do]

- **No in-flight deduplication.** Two concurrent calls with the same arguments both miss and both call the function. For per-request batching and deduplication use [DataLoader](@BASE@/integrations/dataloader/).
- **`null` is never a hit.** A function that resolves to `null` is called again every time.
- **Results must be serializable.** Values go through the driver's serialization, so `Date`, `Map` or class instances come back as plain JSON on most drivers. Return plain data.

:::

## `createCache`: one cache, many functions

`createCache` shares one storage, prefix and default TTL across several functions. It returns a `Cache` with `wrap`, `decorator` and `storage`.

```ts
import { createStorage } from "unstorage";
import { createCache } from "@xtandard/lib/unstorage";

const cache = createCache({ storage: createStorage(), prefix: "api", ttl: 60 });

const getUser = cache.wrap(async (id: string) => db.users.findById(id), {
  toKey: (id) => `user:${id}`,
});
const getPlan = cache.wrap(async (id: string) => billing.plan(id), {
  toKey: (id) => `plan:${id}`,
  ttl: 600, // override the default TTL
});

await cache.storage.removeItem("user:42"); // `storage` is already scoped to "api:"
```

`wrap(fn, overrides?)` takes `ttl` and `toKey` overrides.

:::danger[Give each wrapped function its own key]
With the default `toKey`, the key is only a hash of the arguments, and all `wrap`ped functions share the cache's storage. Two functions called with the same arguments collide: in the example above without `toKey`, `getPlan("42")` would return the cached **user** `"42"`. Give each `wrap` a `toKey` that includes a name (as above), or use a separate `createCache` prefix per function. The decorator below doesn't have this problem for differently named methods.
:::

### As a method decorator

`cache.decorator` caches class methods. Use it bare, or call it to override the TTL:

```ts
const cache = createCache({ storage, prefix: "svc", ttl: 60 });

class UserService {
  @cache.decorator
  async getUser(id: string) {
    return db.users.findById(id);
  }

  @cache.decorator({ ttl: 300 })
  async getProfile(id: string, lang: string) {
    return db.profiles.find(id, lang);
  }
}
```

The key is `` `${methodName}:${hash(args)}` ``, e.g. `getUser:Md3K…`.

- These are **standard (TC39) decorators**, the TypeScript 5 default. They don't work with `experimentalDecorators: true` (legacy decorators), so make sure your compiler or bundler emits standard decorators.
- The key ignores `this` and the class name: all instances share entries, and two classes with a method of the same name on the same `cache` share keys. Use a separate `createCache` (or prefix) per class if their method names overlap.

## See also

- API reference: [`withCache`](@BASE@/api/unstorage/functions/withcache/), [`createCache`](@BASE@/api/unstorage/functions/createcache/), [`Cache`](@BASE@/api/unstorage/interfaces/cache/), [`CacheOptions`](@BASE@/api/unstorage/interfaces/cacheoptions/), [`WithCacheOptions`](@BASE@/api/unstorage/interfaces/withcacheoptions/)
- Source: [`unstorage-utils.ts`](@REPO@/blob/main/src/unstorage-utils.ts)
