/**
 * Convert seconds to milliseconds (`seconds * 1000`). No rounding or validation.
 *
 * @example
 * ```ts
 * import { secondsToMs } from "@xtandard/lib";
 *
 * secondsToMs(1.5); // 1500
 * setTimeout(poll, secondsToMs(30));
 * ```
 */
export const secondsToMs = (seconds: number): number => seconds * 1000;

/**
 * Convert minutes to milliseconds (`minutes * 60_000`). No rounding or validation.
 *
 * @example
 * ```ts
 * import { minutesToMs } from "@xtandard/lib";
 *
 * minutesToMs(5); // 300000
 * setInterval(refresh, minutesToMs(5));
 * ```
 */
export const minutesToMs = (minutes: number): number => secondsToMs(minutes * 60);

/**
 * Convert hours to milliseconds (`hours * 3_600_000`). No rounding or validation.
 * For calendar-aware durations, use the Temporal helpers in `@xtandard/lib/temporal`.
 *
 * @example
 * ```ts
 * import { hoursToMs } from "@xtandard/lib";
 *
 * hoursToMs(24); // 86400000
 * const expiresAt = Date.now() + hoursToMs(24);
 * ```
 */
export const hoursToMs = (hours: number): number => minutesToMs(hours * 60);
