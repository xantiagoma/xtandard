import { combineRateLimits, defaultRateLimit, type RateLimit } from "./rate-limit.ts";

export type HistoryMode = "push" | "replace";

/**
 * Structural type for React's `startTransition` so the core stays React-free.
 * Matches `React.TransitionStartFunction`.
 */
export type StartTransitionFn = (callback: () => void) => void;

export type QueryStateOptions = {
  /** `replace` (default) updates the current entry; `push` adds history. */
  history?: HistoryMode;
  /**
   * `true` (default) updates the URL via the History API only — route loaders
   * and SSR do not run. `false` routes the update through TanStack Router
   * navigation so loaders/validation/pending state participate.
   */
  shallow?: boolean;
  /** Map to TanStack `resetScroll`. Default `false` (no scroll to top). */
  scroll?: boolean;
  /** Default `true`: writing a value equal to the default removes the key. */
  clearOnDefault?: boolean;
  /**
   * Default `true`: a key whose raw value in the URL fails to parse (stale or
   * tampered garbage, e.g. `?tz=Nope`) is stripped from the URL on read, so it
   * resolves cleanly to the default instead of leaving junk in the address bar.
   */
  clearOnInvalid?: boolean;
  /** Throttle/debounce URL commits. Hook state still updates instantly. */
  limitUrlUpdates?: RateLimit;
  /** Wrap non-shallow navigations in a caller-provided React transition. */
  startTransition?: StartTransitionFn;
};

export type ResolvedOptions = {
  history: HistoryMode;
  shallow: boolean;
  scroll: boolean;
  clearOnDefault: boolean;
  clearOnInvalid: boolean;
  limitUrlUpdates: RateLimit;
  startTransition?: StartTransitionFn;
};

/**
 * The bottom option layer, used when no call, parser, hook or adapter sets a
 * value. Matches nuqs. Read-only reference: changing it at runtime is not a
 * supported way to configure the library (use the adapter's `defaultOptions`).
 *
 * @example
 * ```ts
 * import { LIBRARY_DEFAULTS } from "@xtandard/lib/tanstack";
 *
 * LIBRARY_DEFAULTS;
 * // → { history: "replace", shallow: true, scroll: false, clearOnDefault: true,
 * //     clearOnInvalid: true, limitUrlUpdates: { method: "throttle", timeMs: 50 } }
 * ```
 */
export const LIBRARY_DEFAULTS: ResolvedOptions = {
  history: "replace",
  shallow: true,
  scroll: false,
  clearOnDefault: true,
  clearOnInvalid: true,
  limitUrlUpdates: defaultRateLimit,
};

/**
 * Resolve options across precedence layers (highest first):
 * call-level > parser `.withOptions()` > hook options > adapter defaults >
 * library defaults. Each option is picked separately from the first layer
 * that sets it. This is what the hooks run on every setter call; adapter
 * authors can reuse it.
 *
 * @example
 * ```ts
 * import { resolveOptions } from "@xtandard/lib/tanstack";
 *
 * resolveOptions({
 *   callOptions: { history: "push" },
 *   parserOptions: { history: "replace", shallow: false },
 *   adapterDefaults: { scroll: true, shallow: true },
 * });
 * // → { history: "push", shallow: false, scroll: true, clearOnDefault: true,
 * //     clearOnInvalid: true, limitUrlUpdates: { method: "throttle", timeMs: 50 } }
 * ```
 */
export function resolveOptions(layers: {
  callOptions?: QueryStateOptions;
  parserOptions?: QueryStateOptions;
  hookOptions?: QueryStateOptions;
  adapterDefaults?: QueryStateOptions;
}): ResolvedOptions {
  const order = [
    layers.callOptions,
    layers.parserOptions,
    layers.hookOptions,
    layers.adapterDefaults,
  ];
  const pick = <K extends keyof QueryStateOptions>(
    key: K,
  ): NonNullable<QueryStateOptions[K]> | undefined => {
    for (const layer of order) {
      const value = layer?.[key];
      if (value !== undefined) return value;
    }
    return undefined;
  };
  return {
    history: pick("history") ?? LIBRARY_DEFAULTS.history,
    shallow: pick("shallow") ?? LIBRARY_DEFAULTS.shallow,
    scroll: pick("scroll") ?? LIBRARY_DEFAULTS.scroll,
    clearOnDefault: pick("clearOnDefault") ?? LIBRARY_DEFAULTS.clearOnDefault,
    clearOnInvalid: pick("clearOnInvalid") ?? LIBRARY_DEFAULTS.clearOnInvalid,
    limitUrlUpdates: pick("limitUrlUpdates") ?? LIBRARY_DEFAULTS.limitUrlUpdates,
    startTransition: pick("startTransition"),
  };
}

/**
 * Combine resolved options from multiple updates batched in the same tick.
 * The "loudest" update wins: `push` over `replace`, full navigation over
 * shallow, scroll over no-scroll, and the strongest rate limit. The
 * `clearOn*` flags stay on only if both have them on, and `b`'s
 * `startTransition` wins when both set one.
 *
 * @example
 * ```ts
 * import { combineResolvedOptions, debounce, resolveOptions } from "@xtandard/lib/tanstack";
 *
 * const a = resolveOptions({ callOptions: { shallow: true } });
 * const b = resolveOptions({ callOptions: { history: "push", limitUrlUpdates: debounce(300) } });
 * combineResolvedOptions(a, b);
 * // → { history: "push", shallow: true, scroll: false, clearOnDefault: true,
 * //     clearOnInvalid: true, limitUrlUpdates: { method: "debounce", timeMs: 300 } }
 * ```
 */
export function combineResolvedOptions(a: ResolvedOptions, b: ResolvedOptions): ResolvedOptions {
  return {
    history: a.history === "push" || b.history === "push" ? "push" : "replace",
    shallow: a.shallow && b.shallow,
    scroll: a.scroll || b.scroll,
    clearOnDefault: a.clearOnDefault && b.clearOnDefault,
    clearOnInvalid: a.clearOnInvalid && b.clearOnInvalid,
    limitUrlUpdates: combineRateLimits(a.limitUrlUpdates, b.limitUrlUpdates),
    startTransition: b.startTransition ?? a.startTransition,
  };
}
