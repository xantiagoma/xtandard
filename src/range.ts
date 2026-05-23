/**
 * Create a lazy range generator (exclusive end).
 *
 * Supports:
 * - `rangeLazy(end)` → `0..end-1`
 * - `rangeLazy(start, end)` → `start..end-1`
 * - `step` and `direction` (`asc` or `desc`)
 *
 * @example
 * ```ts
 * [...rangeLazy(5)] // [0, 1, 2, 3, 4]
 * [...rangeLazy(2, 5)] // [2, 3, 4]
 * [...rangeLazy(0, 10, { step: 2 })] // [0, 2, 4, 6, 8]
 * [...rangeLazy(0, 5, { direction: "desc" })] // [4, 3, 2, 1, 0]
 * [...rangeLazy(2, 10, { step: 3, direction: "desc" })] // [9, 6, 3]
 * ```
 */
export function rangeLazy(
  end: number,
  config?: { step?: number; direction?: "asc" | "desc" },
): Generator<number>;
export function rangeLazy(
  start: number,
  end: number,
  config?: { step?: number; direction?: "asc" | "desc" },
): Generator<number>;
export function* rangeLazy(
  startOrEnd: number,
  endOrConfig?: number | { step?: number; direction?: "asc" | "desc" },
  maybeConfig?: { step?: number; direction?: "asc" | "desc" },
) {
  const [start, finalEnd, config] =
    typeof endOrConfig === "number"
      ? [startOrEnd, endOrConfig, maybeConfig ?? {}]
      : [0, startOrEnd, endOrConfig ?? {}];

  const { step = 1, direction = "asc" } = config;

  // For desc direction, swap start and end, adjusting for exclusive upper bound
  const [actualStart, actualEnd] =
    direction === "desc" ? [finalEnd - 1, start - 1] : [start, finalEnd];

  const increment = direction === "asc" ? step : -step;

  for (let i = actualStart; direction === "asc" ? i < actualEnd : i > actualEnd; i += increment) {
    yield i;
  }
}

/**
 * Create an eager range array (exclusive end).
 *
 * This is just `Array.from(rangeLazy(...))`.
 *
 * @example
 * ```ts
 * range(5) // [0, 1, 2, 3, 4]
 * range(2, 5) // [2, 3, 4]
 * range(0, 10, { step: 2 }) // [0, 2, 4, 6, 8]
 * range(0, 5, { direction: "desc" }) // [4, 3, 2, 1, 0]
 * ```
 */
export function range(
  end: number,
  config?: { step?: number; direction?: "asc" | "desc" },
): number[];
export function range(
  start: number,
  end: number,
  config?: { step?: number; direction?: "asc" | "desc" },
): number[];
export function range(
  startOrEnd: number,
  endOrConfig?: number | { step?: number; direction?: "asc" | "desc" },
  maybeConfig?: { step?: number; direction?: "asc" | "desc" },
): number[] {
  const [start, finalEnd, config] =
    typeof endOrConfig === "number"
      ? [startOrEnd, endOrConfig, maybeConfig ?? {}]
      : [0, startOrEnd, endOrConfig ?? {}];

  return [...rangeLazy(start, finalEnd, config)];
}
