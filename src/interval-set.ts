/**
 * `IntervalSet<T>`: a normalized set of disjoint intervals over any
 * {@link IntervalDomain} — Guava's `RangeSet` (`TreeRangeSet` coalescing
 * semantics) on top of the `Interval<T>` engine. Immutable, like `Interval`.
 */

import {
  compareCut,
  type Cut,
  Interval,
  type IntervalDomain,
  intervalBetween,
  lowerCut,
  mergeIntervals,
  parseInterval,
  upperCut,
} from "./interval";

/**
 * First index in `[0, length)` where the monotone `predicate` turns true (`length` if never).
 *
 * @internal
 */
export function firstIndex(length: number, predicate: (index: number) => boolean): number {
  let lo = 0;
  let hi = length;

  while (lo < hi) {
    const mid = (lo + hi) >>> 1;

    if (predicate(mid)) hi = mid;
    else lo = mid + 1;
  }

  return lo;
}

/**
 * The cut just right of `value` (`above value`), for "does this interval reach past it".
 *
 * @internal
 */
export function cutAbove<T>(value: T): Cut<T> {
  return { kind: "above", value };
}

/**
 * Same set of values: equal lower and upper cuts (so `[0,+Infinity]` written either way matches).
 *
 * @internal
 */
export function sameInterval<T>(
  domain: IntervalDomain<T>,
  a: Interval<T>,
  b: Interval<T>,
): boolean {
  if (a.isEmpty || b.isEmpty) return a.isEmpty === b.isEmpty;

  return (
    compareCut(domain, lowerCut(domain, a.lower), lowerCut(domain, b.lower)) === 0 &&
    compareCut(domain, upperCut(domain, a.upper), upperCut(domain, b.upper)) === 0
  );
}

/**
 * `a \ b` for two intervals, computed on cuts (exact on the extended line, `±∞` points kept).
 *
 * @internal
 */
export function subtractInterval<T>(
  domain: IntervalDomain<T>,
  a: Interval<T>,
  b: Interval<T>,
): Interval<T>[] {
  if (a.isEmpty) return [];
  if (b.isEmpty) return [a];

  const aLower = lowerCut(domain, a.lower);
  const aUpper = upperCut(domain, a.upper);
  const bLower = lowerCut(domain, b.lower);
  const bUpper = upperCut(domain, b.upper);

  // Disjoint: nothing to take away.
  if (compareCut(domain, bUpper, aLower) <= 0 || compareCut(domain, aUpper, bLower) <= 0) {
    return [a];
  }

  return [intervalBetween(domain, aLower, bLower), intervalBetween(domain, bUpper, aUpper)].filter(
    (piece) => !piece.isEmpty,
  );
}

/** The whole line of a domain: open `±∞` sides, closed where the domain declares `±∞` values. */
function universe<T>(domain: IntervalDomain<T>): Interval<T> {
  return Interval.of(
    domain,
    { unbounded: true, closed: domain.negativeInfinity !== undefined },
    { unbounded: true, closed: domain.positiveInfinity !== undefined },
  );
}

/**
 * An immutable set of values of `T`, stored as the minimal sorted list of
 * disjoint, non-connected intervals (Guava's `RangeSet`). Adding an interval
 * coalesces it with every interval it overlaps **or touches**, so on a discrete
 * domain `[1,3] ∪ [4,6]` is stored as `[1,6]`, and on a continuous one
 * `[1,2) ∪ [2,3]` as `[1,3]`. Every operation returns a new set.
 *
 * Build one with {@link IntervalSet.of} (any bag of intervals, overlapping or
 * not, in any order), {@link IntervalSet.empty}, {@link IntervalSet.all} or
 * {@link IntervalSet.parse}. Pass the domain the intervals use — a bound class
 * exposes it as `NumberInterval.domain`, `InstantInterval.domain`, …
 *
 * Lookups (`contains`, `intervalContaining`, `encloses`, `intersects`, `subSet`)
 * binary-search the sorted list; the set algebra is linear in the two sizes.
 *
 * @example
 * ```ts
 * import { IntegerInterval, IntervalSet } from "@xtandard/lib/interval";
 *
 * const set = IntervalSet.of(IntegerInterval.domain, [
 *   IntegerInterval.closed(10, 12),
 *   IntegerInterval.closed(1, 3),
 *   IntegerInterval.closed(4, 6), // adjacent to [1,3] on the integers
 * ]);
 * set.toString(); // "[1,6] ∪ [10,12]"
 * set.contains(5); // true
 * set.contains(8); // false
 * set.gaps().toString(); // "[7,9]"
 * set.remove(IntegerInterval.closed(2, 4)).toString(); // "[1,1] ∪ [5,6] ∪ [10,12]"
 * set.complement().toString(); // "(-Infinity,0] ∪ [7,9] ∪ [13,+Infinity)"
 * ```
 *
 * @example Continuous domains keep brackets exact
 * ```ts
 * import { IntervalSet, NumberInterval } from "@xtandard/lib/interval";
 *
 * const set = IntervalSet.of(NumberInterval.domain, [
 *   NumberInterval.closedOpen(0, 1),
 *   NumberInterval.closed(1, 2), // touches [0,1) at 1 → coalesced
 *   NumberInterval.open(5, 6),
 * ]);
 * set.toString(); // "[0,2] ∪ (5,6)"
 * set.difference(NumberInterval.closed(1, 5.5)).toString(); // "[0,1) ∪ (5.5,6)"
 * set.length(); // 3 (total measure: 2 + 1)
 * ```
 */
export class IntervalSet<T> implements Iterable<Interval<T>> {
  /** The domain that orders/steps/serializes `T` (shared with every interval in the set). */
  readonly domain: IntervalDomain<T>;
  /** Sorted, disjoint, non-connected, non-empty. */
  readonly #intervals: readonly Interval<T>[];

  private constructor(domain: IntervalDomain<T>, normalized: readonly Interval<T>[]) {
    this.domain = domain;
    this.#intervals = normalized;
  }

  /**
   * The set covering every value in `intervals` (any order; overlapping, touching
   * and empty intervals are fine — they are coalesced/dropped).
   */
  static of<T>(domain: IntervalDomain<T>, intervals: Iterable<Interval<T>> = []): IntervalSet<T> {
    return new IntervalSet(domain, mergeIntervals(domain, [...intervals]));
  }

  /** The empty set `∅`. */
  static empty<T>(domain: IntervalDomain<T>): IntervalSet<T> {
    return new IntervalSet(domain, []);
  }

  /**
   * The whole line of the domain: `(-Infinity,+Infinity)`, or `[-Infinity,+Infinity]`
   * when the domain declares `±∞` values (`numberDomain`). The complement of `∅`.
   */
  static all<T>(domain: IntervalDomain<T>): IntervalSet<T> {
    return new IntervalSet(domain, [universe(domain)]);
  }

  /**
   * Parse the {@link IntervalSet.format} form — intervals joined by `∪`
   * (`"[1,3] ∪ [5,7)"`), or `∅` / empty text for the empty set. Each piece goes
   * through `parseInterval`, so the same tokens and domain rules apply; the
   * pieces may be in any order and may overlap.
   *
   * @throws If a piece is not a valid interval for the domain.
   *
   * @example
   * ```ts
   * import { IntervalSet, NumberInterval } from "@xtandard/lib/interval";
   *
   * IntervalSet.parse(NumberInterval.domain, "[5,6] ∪ [0,2) ∪ [1,3]").toString(); // "[0,3] ∪ [5,6]"
   * IntervalSet.parse(NumberInterval.domain, "∅").isEmpty; // true
   * ```
   */
  static parse<T>(domain: IntervalDomain<T>, text: string): IntervalSet<T> {
    const trimmed = text.trim();

    if (trimmed === "" || trimmed === "∅") return IntervalSet.empty(domain);

    return IntervalSet.of(
      domain,
      trimmed.split("∪").map((piece) => parseInterval(domain, piece)),
    );
  }

  /** Wrap an argument (a set, one interval, or a bag of intervals) as a set. */
  #toSet(other: Interval<T> | Iterable<Interval<T>>): IntervalSet<T> {
    if (other instanceof IntervalSet) return other;
    if (other instanceof Interval) return IntervalSet.of(this.domain, [other]);

    return IntervalSet.of(this.domain, other);
  }

  // --- queries -------------------------------------------------------------

  /** `true` when the set contains no values. */
  get isEmpty(): boolean {
    return this.#intervals.length === 0;
  }

  /** The number of disjoint intervals (what iteration yields), not the number of values. */
  get size(): number {
    return this.#intervals.length;
  }

  /** Whether `value` is a member (respects open/closed and `domain.isValid`). */
  contains(value: T): boolean {
    return this.intervalContaining(value) !== null;
  }

  /**
   * The interval of the set that contains `value`, or `null` if it is not a
   * member (Guava's `rangeContaining`).
   */
  intervalContaining(value: T): Interval<T> | null {
    if (this.domain.isValid && !this.domain.isValid(value)) return null;

    const above = cutAbove(value);
    const index = firstIndex(
      this.#intervals.length,
      (i) => compareCut(this.domain, upperCut(this.domain, this.#intervals[i]!.upper), above) >= 0,
    );
    const candidate = this.#intervals[index];

    return candidate?.contains(value) ? candidate : null;
  }

  /**
   * Whether every value of `other` (an interval, a set, or a bag of intervals) is
   * in this set. An interval is enclosed only if ONE interval of the set encloses
   * it — never across a gap.
   */
  encloses(other: Interval<T> | Iterable<Interval<T>>): boolean {
    if (!(other instanceof Interval)) {
      return this.#toSet(other).#intervals.every((interval) => this.encloses(interval));
    }

    if (other.isEmpty) return true;

    const otherUpper = upperCut(this.domain, other.upper);
    const index = firstIndex(
      this.#intervals.length,
      (i) =>
        compareCut(this.domain, upperCut(this.domain, this.#intervals[i]!.upper), otherUpper) >= 0,
    );

    return this.#intervals[index]?.encloses(other) ?? false;
  }

  /** Whether this set and `other` (an interval, a set, or a bag of intervals) share any value. */
  intersects(other: Interval<T> | Iterable<Interval<T>>): boolean {
    if (!(other instanceof Interval)) {
      return this.#toSet(other).#intervals.some((interval) => this.intersects(interval));
    }

    if (other.isEmpty) return false;

    const otherLower = lowerCut(this.domain, other.lower);
    const index = firstIndex(
      this.#intervals.length,
      (i) =>
        compareCut(this.domain, upperCut(this.domain, this.#intervals[i]!.upper), otherLower) > 0,
    );

    return this.#intervals[index]?.overlaps(other) ?? false;
  }

  /** Whether this set contains every value of `other` (alias of `encloses`). */
  isSupersetOf(other: Interval<T> | Iterable<Interval<T>>): boolean {
    return this.encloses(other);
  }

  /** Whether every value of this set is in `other`. */
  isSubsetOf(other: Interval<T> | Iterable<Interval<T>>): boolean {
    return this.#toSet(other).encloses(this);
  }

  /** Whether this set and `other` share no value (`!intersects`). */
  isDisjointFrom(other: Interval<T> | Iterable<Interval<T>>): boolean {
    return !this.intersects(other);
  }

  /**
   * The smallest single interval enclosing the whole set (across its gaps); the
   * empty interval for an empty set.
   */
  span(): Interval<T> {
    const first = this.#intervals[0];
    const last = this.#intervals.at(-1);

    return first && last ? first.span(last) : Interval.blank(this.domain);
  }

  /**
   * The holes between consecutive intervals — the complement within {@link span}.
   * Empty when the set has fewer than two intervals.
   */
  gaps(): IntervalSet<T> {
    const out: Interval<T>[] = [];

    for (let i = 1; i < this.#intervals.length; i++) {
      out.push(
        intervalBetween(
          this.domain,
          upperCut(this.domain, this.#intervals[i - 1]!.upper),
          lowerCut(this.domain, this.#intervals[i]!.lower),
        ),
      );
    }

    return new IntervalSet(this.domain, out);
  }

  /**
   * Total size: the sum of each interval's `length()` (a measure for continuous
   * domains, an element count for discrete ones). `0` for the empty set; `null`
   * if any interval is unbounded or the domain has no `measure`.
   */
  length(): number | null {
    let total = 0;

    for (const interval of this.#intervals) {
      const length = interval.length();
      if (length === null) return null;
      total += length;
    }

    return total;
  }

  // --- set operations ------------------------------------------------------

  /** Every value not in this set, relative to the domain's whole line ({@link IntervalSet.all}). */
  complement(): IntervalSet<T> {
    const whole = universe(this.domain);
    const out: Interval<T>[] = [];
    let cursor = lowerCut(this.domain, whole.lower);

    for (const interval of this.#intervals) {
      const hole = intervalBetween(this.domain, cursor, lowerCut(this.domain, interval.lower));
      if (!hole.isEmpty) out.push(hole);
      cursor = upperCut(this.domain, interval.upper);
    }

    const tail = intervalBetween(this.domain, cursor, upperCut(this.domain, whole.upper));
    if (!tail.isEmpty) out.push(tail);

    return new IntervalSet(this.domain, out);
  }

  /** Values in either (coalesced). Accepts a set, one interval, or a bag of intervals. */
  union(other: Interval<T> | Iterable<Interval<T>>): IntervalSet<T> {
    const set = this.#toSet(other);
    if (set.isEmpty) return this;
    if (this.isEmpty) return set;

    return new IntervalSet(this.domain, mergeIntervals(this.domain, [...this, ...set]));
  }

  /** Values in both. Accepts a set, one interval, or a bag of intervals. */
  intersection(other: Interval<T> | Iterable<Interval<T>>): IntervalSet<T> {
    const a = this.#intervals;
    const b = this.#toSet(other).#intervals;
    const out: Interval<T>[] = [];
    let i = 0;
    let j = 0;

    // Two pointers; pieces from different input intervals are separated by a
    // gap of one of the inputs, so the result is already normalized.
    while (i < a.length && j < b.length) {
      const x = a[i]!;
      const y = b[j]!;
      const overlap = x.intersection(y);
      if (!overlap.isEmpty) out.push(overlap);

      if (
        compareCut(this.domain, upperCut(this.domain, x.upper), upperCut(this.domain, y.upper)) < 0
      ) {
        i++;
      } else {
        j++;
      }
    }

    return new IntervalSet(this.domain, out);
  }

  /** Values in this set but not in `other` (`this ∩ complement(other)`). */
  difference(other: Interval<T> | Iterable<Interval<T>>): IntervalSet<T> {
    const set = this.#toSet(other);
    if (set.isEmpty || this.isEmpty) return this;

    return this.intersection(set.complement());
  }

  /** Values in exactly one of the two. */
  symmetricDifference(other: Interval<T> | Iterable<Interval<T>>): IntervalSet<T> {
    const set = this.#toSet(other);

    return this.difference(set).union(set.difference(this));
  }

  /** Add one interval (shorthand for `union(interval)`; Guava's `add`). */
  add(interval: Interval<T>): IntervalSet<T> {
    return this.union(interval);
  }

  /** Remove one interval (shorthand for `difference(interval)`; Guava's `remove`). */
  remove(interval: Interval<T>): IntervalSet<T> {
    return this.difference(interval);
  }

  /** The part of this set inside `window` (Guava's `subRangeSet`). */
  subSet(window: Interval<T>): IntervalSet<T> {
    if (window.isEmpty) return IntervalSet.empty(this.domain);

    const windowLower = lowerCut(this.domain, window.lower);
    const windowUpper = upperCut(this.domain, window.upper);
    const out: Interval<T>[] = [];
    const start = firstIndex(
      this.#intervals.length,
      (i) =>
        compareCut(this.domain, upperCut(this.domain, this.#intervals[i]!.upper), windowLower) > 0,
    );

    for (let i = start; i < this.#intervals.length; i++) {
      const interval = this.#intervals[i]!;
      if (compareCut(this.domain, lowerCut(this.domain, interval.lower), windowUpper) >= 0) break;

      const piece = interval.intersection(window);
      if (!piece.isEmpty) out.push(piece);
    }

    return new IntervalSet(this.domain, out);
  }

  // --- equality / iteration / serialization --------------------------------

  /** Same domain and same values (compares the normalized intervals). */
  equals(other: IntervalSet<T>): boolean {
    if (this.domain.name !== other.domain.name) return false;
    if (this.#intervals.length !== other.#intervals.length) return false;

    return this.#intervals.every((interval, i) =>
      sameInterval(this.domain, interval, other.#intervals[i]!),
    );
  }

  /** The intervals in ascending order (sorted, disjoint, non-connected). */
  [Symbol.iterator](): IterableIterator<Interval<T>> {
    return this.#intervals[Symbol.iterator]();
  }

  /** A fresh array of the intervals, in ascending order. */
  toArray(): Interval<T>[] {
    return [...this.#intervals];
  }

  /**
   * Render as `[1,3] ∪ [5,7)` (each piece via `Interval.format`), or `∅` when
   * empty. Pass custom `±∞` tokens via options. Read it back with {@link IntervalSet.parse}.
   */
  format(options?: { negativeInfinity?: string; positiveInfinity?: string }): string {
    if (this.isEmpty) return "∅";

    return this.#intervals.map((interval) => interval.format(options)).join(" ∪ ");
  }

  /** Default `format()` (e.g. `"[1,3] ∪ [5,7)"`). */
  toString(): string {
    return this.format();
  }
}
