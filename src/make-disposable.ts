import type { MaybePromise } from "./types";

import { isAsyncDisposable } from "./is-disposable";
import { DisposedSymbol } from "./symbols";

export interface MakeDisposableOptions<T> {
  onInit?: (resource: T) => MaybePromise<void>;
  onDispose?: (resource: T) => MaybePromise<void>;
  /** Allow overwriting if the object is already disposable. Defaults to `false`. */
  overwrite?: boolean;
}

export type Disposable<T> = T & {
  [Symbol.asyncDispose]: () => Promise<void>;
  readonly [DisposedSymbol]: boolean;
};

/**
 * Wrap a resource with an `asyncDispose` handler so it can be used with `await using`.
 *
 * Assigns `Symbol.asyncDispose` directly on the object (no Proxy).
 * Protects against double-dispose and accidental overwrite.
 *
 * @throws {TypeError} If the object already has a dispose handler and `overwrite` is not `true`.
 *
 * @example
 * ```ts
 * import { makeDisposable, DisposedSymbol } from "@demi.casa/utils";
 *
 * await using client = await makeDisposable(
 *   redis.createClient({ password: REDIS_PASSWORD }),
 *   {
 *     onInit: async (resource) => await resource.connect(),
 *     onDispose: async (resource) => await resource.disconnect(),
 *   },
 * );
 *
 * client[DisposedSymbol]; // false
 * ```
 */
export async function makeDisposable<T extends object>(
  resource: T,
  { onDispose, onInit, overwrite = false }: MakeDisposableOptions<T> = {},
): Promise<Disposable<T>> {
  if (!overwrite && isAsyncDisposable(resource)) {
    throw new TypeError("Resource is already disposable. Pass { overwrite: true } to replace.");
  }

  await onInit?.(resource);

  let disposed = false;

  const disposable = resource as Disposable<T>;

  Object.defineProperty(disposable, Symbol.asyncDispose, {
    value: async () => {
      if (disposed) return;
      disposed = true;
      await onDispose?.(resource);
    },
    enumerable: false,
    configurable: true,
  });

  Object.defineProperty(disposable, DisposedSymbol, {
    get: () => disposed,
    enumerable: false,
    configurable: true,
  });

  return disposable;
}
