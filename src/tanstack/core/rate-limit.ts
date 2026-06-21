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
 */
export function throttle(timeMs: number): RateLimit {
  return { method: "throttle", timeMs };
}

/** Debounce: wait until `timeMs` of quiet has elapsed before committing. */
export function debounce(timeMs: number): RateLimit {
  return { method: "debounce", timeMs };
}

/** nuqs-compatible default: throttle at 50ms. */
export const defaultRateLimit: RateLimit = throttle(50);

/**
 * When several updates coincide in the same tick, the strongest limit wins:
 * the longest delay, and debounce dominates throttle (it waits for settling).
 */
export function combineRateLimits(a: RateLimit, b: RateLimit): RateLimit {
  const method = a.method === "debounce" || b.method === "debounce" ? "debounce" : "throttle";
  return { method, timeMs: Math.max(a.timeMs, b.timeMs) };
}
