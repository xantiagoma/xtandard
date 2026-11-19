/**
 * Rate limiting for URL commits.
 *
 * Hook state always updates synchronously; only the write to the URL (and any
 * downstream router navigation) is rate-limited. This mirrors nuqs: returned
 * state is instant, URL commits are throttled/debounced.
 */

export type RateLimit =
  | { readonly method: "throttle"; readonly timeMs: number }
  | { readonly method: "debounce"; readonly timeMs: number };

/**
 * Throttle: commit the first update quickly, then at most once per `timeMs`.
 * Pass `Infinity` to keep state in sync while never committing to the URL.
 * Use it as the `limitUrlUpdates` option.
 *
 * @example
 * ```ts
 * import { parseAsString, throttle, useQueryState } from "@xtandard/lib/tanstack";
 *
 * throttle(120); // → { method: "throttle", timeMs: 120 }
 *
 * // Slider: state follows the thumb, the URL updates at most every 120 ms.
 * const [q, setQ] = useQueryState(
 *   "q",
 *   parseAsString.withDefault("").withOptions({ limitUrlUpdates: throttle(120) }),
 * );
 * ```
 */
export function throttle(timeMs: number): RateLimit {
  return { method: "throttle", timeMs };
}

/**
 * Debounce: wait until `timeMs` of quiet has elapsed before committing. Use it
 * as the `limitUrlUpdates` option, e.g. for a search box that should only
 * write the URL once the user stops typing.
 *
 * @example
 * ```ts
 * import { debounce, parseAsString, useQueryState } from "@xtandard/lib/tanstack";
 *
 * debounce(300); // → { method: "debounce", timeMs: 300 }
 *
 * const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
 * // In the input's onChange: state updates now, the URL 300 ms after the last keystroke.
 * void setQ(event.target.value, { limitUrlUpdates: debounce(300) });
 * ```
 */
export function debounce(timeMs: number): RateLimit {
  return { method: "debounce", timeMs };
}

/**
 * nuqs-compatible default: throttle at 50ms. It is the `limitUrlUpdates`
 * used when no layer sets one.
 *
 * @example
 * ```ts
 * import { defaultRateLimit } from "@xtandard/lib/tanstack";
 *
 * defaultRateLimit; // → { method: "throttle", timeMs: 50 }
 * ```
 */
export const defaultRateLimit: RateLimit = throttle(50);

/**
 * When several updates coincide in the same tick, the strongest limit wins:
 * the longest delay, and debounce dominates throttle (it waits for settling).
 * The store uses this to merge batched updates; adapter authors can reuse it.
 *
 * @example
 * ```ts
 * import { combineRateLimits, debounce, throttle } from "@xtandard/lib/tanstack";
 *
 * combineRateLimits(throttle(50), throttle(120)); // → { method: "throttle", timeMs: 120 }
 * combineRateLimits(throttle(50), debounce(10)); // → { method: "debounce", timeMs: 50 }
 * ```
 */
export function combineRateLimits(a: RateLimit, b: RateLimit): RateLimit {
  const method = a.method === "debounce" || b.method === "debounce" ? "debounce" : "throttle";
  return { method, timeMs: Math.max(a.timeMs, b.timeMs) };
}
