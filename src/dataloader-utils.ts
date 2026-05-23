import DataLoader from "dataloader";

export interface CreateLoaderOptions<Ctx, K, C> {
  maxBatchSize?: number;
  cacheKeyFn?: (key: K) => C;
  /**
   * Extract the cache map from the context.
   * Defaults to `(ctx) => ctx.dl` if not provided.
   */
  getCache?: (ctx: Ctx) => Map<symbol, unknown>;
}

/**
 * Create a batched loader that lazily initializes a DataLoader per context.
 *
 * The context object holds the cache (typically a `Map` per request).
 * By default it looks for `ctx.dl`, but you can customize with `getCache`.
 *
 * @example Simple (keys default to string)
 * ```ts
 * const loadUser = createLoader<User, MyContext>(
 *   async ({ context, keys }) => {
 *     return db.users.findMany({ where: { id: { in: [...keys] } } });
 *   },
 * );
 *
 * // In a resolver:
 * const user = await loadUser({ context, id: "user_123" });
 * ```
 *
 * @example Composite keys with cacheKeyFn
 * ```ts
 * const loadByTag = createLoader<Result, MyContext, TagKey>(
 *   async ({ context, keys }) => fetchByTags(keys),
 *   { cacheKeyFn: (key) => `${key.object}::${key.id}` },
 * );
 * ```
 *
 * @example Custom cache location
 * ```ts
 * const loader = createLoader<User, MyContext>(
 *   async ({ context, keys }) => fetchUsers(keys),
 *   { getCache: (ctx) => ctx.loaders },
 * );
 * ```
 */
export function createLoader<T, Ctx = { dl: Map<symbol, unknown> }, K = string, C = string>(
  fn: (arg: { context: Ctx; keys: readonly K[] }) => Promise<T[]>,
  options?: CreateLoaderOptions<Ctx, K, C>,
) {
  const key = Symbol();
  const getCache =
    options?.getCache ??
    ((ctx: Ctx) => (ctx as Record<string, unknown>).dl as Map<symbol, unknown>);

  return async (arg: { context: Ctx; id: K }): Promise<T> => {
    const cache = getCache(arg.context);

    if (!cache.has(key)) {
      cache.set(
        key,
        new DataLoader<K, T, C>(async (keys) => fn({ context: arg.context, keys }), {
          maxBatchSize: options?.maxBatchSize ?? 300,
          cacheKeyFn: options?.cacheKeyFn,
        }),
      );
    }

    return (cache.get(key) as DataLoader<K, T>).load(arg.id);
  };
}
