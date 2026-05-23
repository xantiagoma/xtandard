import type { Storage, StorageValue, TransactionOptions } from "unstorage";

import { hash } from "ohash";
import { prefixStorage } from "unstorage";

interface CacheEntry<T extends StorageValue = StorageValue> {
  value: T;
  /** Epoch ms. Used as fallback TTL for drivers that don't support native TTL. */
  expiresAt?: number;
}

export interface CacheOptions {
  /** unstorage instance — use any driver (memory, redis, fs, db, etc.). */
  storage: Storage;
  /** Key prefix. Uses unstorage's `prefixStorage` for proper scoping. */
  prefix?: string;
  /**
   * TTL in seconds.
   * Passed to the driver via `TransactionOptions` (native TTL for redis, etc.)
   * AND stored as `expiresAt` in the entry (fallback for drivers without native TTL).
   */
  ttl?: number;
}

export interface WithCacheOptions<TArgs extends unknown[]> extends CacheOptions {
  /**
   * Convert the args to a cache key string.
   * Defaults to `hash(args)` via ohash.
   */
  toKey?: (...args: TArgs) => string;
}

// ─── Internal ──────────────────────────────────────────────

function makeScopedStorage(storage: Storage, prefix?: string) {
  return prefix ? prefixStorage(storage, prefix) : storage;
}

async function cacheGet<T extends StorageValue>(scoped: Storage, key: string): Promise<T | null> {
  const cached = await scoped.getItem<CacheEntry<T>>(key);
  if (cached === null) return null;
  if (cached.expiresAt == null || cached.expiresAt > Date.now()) {
    return cached.value;
  }
  await scoped.removeItem(key);
  return null;
}

async function cacheSet<T extends StorageValue>(
  scoped: Storage,
  key: string,
  value: T,
  ttl?: number,
): Promise<void> {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: ttl != null ? Date.now() + ttl * 1000 : undefined,
  };
  const txOpts: TransactionOptions | undefined = ttl != null ? { ttl } : undefined;
  await scoped.setItem<CacheEntry<T>>(key, entry, txOpts);
}

// ─── withCache (function wrapper) ──────────────────────────

/**
 * Wrap an async function with a persistent cache layer backed by unstorage.
 * Supports functions with any number of arguments.
 *
 * @example Single arg
 * ```ts
 * const loadUser = withCache(
 *   async (id: string) => db.users.findById(id),
 *   { storage: createStorage(), prefix: "user", ttl: 60 },
 * );
 * await loadUser("user_123");
 * ```
 *
 * @example Multiple args
 * ```ts
 * const search = withCache(
 *   async (query: string, page: number) => api.search(query, page),
 *   { storage, prefix: "search", ttl: 300 },
 * );
 * await search("hello", 1);
 * ```
 *
 * @example Custom toKey
 * ```ts
 * const loadUser = withCache(
 *   async (id: string, role: string) => fetchUser(id, role),
 *   { storage, prefix: "user", toKey: (id) => id },
 * );
 * ```
 */
export function withCache<TArgs extends unknown[], TResult extends StorageValue>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: WithCacheOptions<TArgs>,
): (...args: TArgs) => Promise<TResult> {
  const { storage, prefix, ttl, toKey = (...args: TArgs) => hash(args) } = options;
  const scoped = makeScopedStorage(storage, prefix);

  return async (...args: TArgs): Promise<TResult> => {
    const key = toKey(...args);
    const cached = await cacheGet<TResult>(scoped, key);
    if (cached !== null) return cached;

    const result = await fn(...args);
    await cacheSet(scoped, key, result, ttl);
    return result;
  };
}

// ─── createCache (decorator + wrapper factory) ─────────────

type MethodDecorator = <This, Args extends unknown[], Return extends StorageValue>(
  target: (this: This, ...args: Args) => Promise<Return>,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>,
) => (this: This, ...args: Args) => Promise<Return>;

export interface Cache {
  /** Wrap a standalone async function (any number of args). */
  wrap: <TArgs extends unknown[], TResult extends StorageValue>(
    fn: (...args: TArgs) => Promise<TResult>,
    overrides?: Partial<WithCacheOptions<TArgs>>,
  ) => (...args: TArgs) => Promise<TResult>;

  /** Use as decorator: `@cache.decorator` or `@cache.decorator({ ttl: 30 })` */
  decorator: MethodDecorator & ((overrides: Partial<CacheOptions>) => MethodDecorator);

  /** The scoped unstorage instance (for manual inspection/invalidation). */
  storage: Storage;
}

/**
 * Create a reusable cache instance that can be used as a decorator or wrapper.
 *
 * @example As decorator
 * ```ts
 * const cache = createCache({ storage: createStorage(), prefix: "api", ttl: 60 });
 *
 * class UserService {
 *   @cache.decorator
 *   async getUser(id: string) { return db.users.findById(id); }
 *
 *   @cache.decorator({ ttl: 300 })
 *   async getProfile(id: string, lang: string) { return db.profiles.find(id, lang); }
 * }
 * ```
 *
 * @example As wrapper
 * ```ts
 * const cache = createCache({ storage, prefix: "api", ttl: 60 });
 * const loadUser = cache.wrap(async (id: string, role: string) => fetchUser(id, role));
 * ```
 */
export function createCache(options: CacheOptions): Cache {
  const { storage, prefix, ttl } = options;
  const scoped = makeScopedStorage(storage, prefix);

  function makeDecorator(overrides?: Partial<CacheOptions>): MethodDecorator {
    const effectiveTtl = overrides?.ttl ?? ttl;

    return <This, Args extends unknown[], Return extends StorageValue>(
      target: (this: This, ...args: Args) => Promise<Return>,
      context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>,
    ) => {
      const methodName = String(context.name);

      return async function (this: This, ...args: Args): Promise<Return> {
        const key = `${methodName}:${hash(args)}`;
        const cached = await cacheGet<Return>(scoped, key);
        if (cached !== null) return cached;

        const result = await target.call(this, ...args);
        await cacheSet(scoped, key, result, effectiveTtl);
        return result;
      };
    };
  }

  const decorator = new Proxy(makeDecorator(), {
    apply(target, thisArg, args) {
      const [first, second] = args;
      // Called as @cache.decorator({ ttl: 30 }) — first arg is options object
      if (typeof first === "object" && first !== null && typeof second === "undefined") {
        return makeDecorator(first as Partial<CacheOptions>);
      }
      // Called as @cache.decorator — first arg is the method, second is context
      return (target as Function).apply(thisArg, args);
    },
  }) as MethodDecorator & ((overrides: Partial<CacheOptions>) => MethodDecorator);

  return {
    wrap: <TArgs extends unknown[], TResult extends StorageValue>(
      fn: (...args: TArgs) => Promise<TResult>,
      overrides?: Partial<WithCacheOptions<TArgs>>,
    ) => {
      const effectiveTtl = overrides?.ttl ?? ttl;
      const toKey = overrides?.toKey ?? ((...args: TArgs) => hash(args));

      return async (...args: TArgs): Promise<TResult> => {
        const key = toKey(...args);
        const cached = await cacheGet<TResult>(scoped, key);
        if (cached !== null) return cached;

        const result = await fn(...args);
        await cacheSet(scoped, key, result, effectiveTtl);
        return result;
      };
    },

    decorator,
    storage: scoped,
  };
}
