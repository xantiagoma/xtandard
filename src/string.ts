/**
 * Normalize a value that could be a string, array of strings, null, or undefined
 * into a single string or undefined.
 *
 * Useful for handling query params, headers, and other values that may come as arrays.
 *
 * @example
 * ```ts
 * ensureString("hello"); // "hello"
 * ensureString(["a", "b"]); // "a"
 * ensureString(null); // undefined
 * ensureString(undefined); // undefined
 * ```
 */
export function ensureString(source?: string | string[] | null): string | undefined {
  return (source == null || typeof source === "string" ? source : source[0]) ?? undefined;
}

/**
 * Natural sort comparator (Finder/Explorer-like).
 * Numbers within strings are compared numerically, not lexicographically.
 *
 * @example
 * ```ts
 * ["file10", "file2", "file1"].sort(naturalSortCompare);
 * // ["file1", "file2", "file10"]
 * ```
 */
export function naturalSortCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Calculate Jaro-Winkler distance between two strings.
 * Returns a similarity score from 0.0 (no similarity) to 1.0 (identical).
 *
 * @example
 * ```ts
 * jaroWinklerDistance("martha", "marhta"); // ~0.961
 * jaroWinklerDistance("hello", "HELLO"); // 1.0 (case insensitive)
 * jaroWinklerDistance("hello", "HELLO", { caseSensitive: true }); // 0.0
 * ```
 */
export function jaroWinklerDistance(
  a: string,
  b: string,
  options?: { caseSensitive?: boolean },
): number {
  const caseSensitive = options?.caseSensitive ?? false;

  if (a.length === 0 || b.length === 0) return 0;

  const s1 = caseSensitive ? a : a.toUpperCase();
  const s2 = caseSensitive ? b : b.toUpperCase();

  if (s1 === s2) return 1;

  const range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = Array.from<boolean>({ length: s1.length }).fill(false);
  const s2Matches = Array.from<boolean>({ length: s2.length }).fill(false);
  let m = 0;

  for (let i = 0; i < s1.length; i++) {
    const low = i >= range ? i - range : 0;
    const high = i + range <= s2.length - 1 ? i + range : s2.length - 1;

    for (let j = low; j <= high; j++) {
      if (!s1Matches[i] && !s2Matches[j] && s1[i] === s2[j]) {
        m++;
        s1Matches[i] = s2Matches[j] = true;
        break;
      }
    }
  }

  if (m === 0) return 0;

  let k = 0;
  let numTrans = 0;

  for (let i = 0; i < s1.length; i++) {
    if (s1Matches[i]) {
      for (let j = k; j < s2.length; j++) {
        if (s2Matches[j]) {
          k = j + 1;
          break;
        }
      }
      if (s1[i] !== s2[k - 1]) numTrans++;
    }
  }

  let weight = (m / s1.length + m / s2.length + (m - numTrans / 2) / m) / 3;

  let l = 0;
  const p = 0.1;

  if (weight > 0.7) {
    while (s1[l] === s2[l] && l < 4) l++;
    weight = weight + l * p * (1 - weight);
  }

  return weight;
}
