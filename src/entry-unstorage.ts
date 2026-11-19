/**
 * `withCache` / `createCache` helpers on top of unstorage (peers `unstorage`, `ohash`).
 *
 * Import from `@xtandard/lib/unstorage`.
 *
 * @module unstorage
 */

export { withCache, createCache } from "./unstorage-utils.ts";
export type {
  CacheOptions,
  WithCacheOptions,
  Cache,
  MethodDecorator as CacheMethodDecorator,
} from "./unstorage-utils.ts";
