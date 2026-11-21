/**
 * `IntervalMap<T, V>`: a map from disjoint intervals of any {@link IntervalDomain}
 * to values — Guava's `RangeMap` (`TreeRangeMap`) on top of the `Interval<T>`
 * engine. Immutable, like `Interval`.
 */

import {
  compareCut,
  type Cut,
  Interval,
  type IntervalDomain,
  lowerCut,
  upperCut,
} from "./interval";
import { cutAbove, firstIndex, IntervalSet, sameInterval, subtractInterval } from "./interval-set";

/** One `[interval, value]` pair of an {@link IntervalMap} (the shape `Map` entries have). */
export type IntervalMapEntry<T, V> = readonly [interval: Interval<T>, value: V];

/** Options for {@link IntervalMap.of} / {@link IntervalMap.empty}. */
export interface IntervalMapOptions<V> {
  /**
   * When two values count as equal — used by `putCoalescing` (to merge connected
   * entries) and by `equals`. Default `Object.is`; pass a structural check for
   * object values (e.g. dinero amounts, `{ rate, currency }` records).
   */
  valueEquals?: (a: V, b: V) => boolean;
}

/**
 * An immutable map from disjoint intervals of `T` to values `V` (Guava's
 * `RangeMap`). Each value of `T` maps to at most one `V`; {@link IntervalMap.put}
 * overwrites whatever it overlaps, splitting the entries it cuts through, and
 * {@link IntervalMap.putCoalescing} also merges the new entry with connected
 * neighbours that hold an equal value. Every operation returns a new map.
 *
 * Entries are kept sorted; `get` / `getEntry` binary-search them. Unlike an
 * {@link IntervalSet}, `put` does not merge touching entries even when their
 * values are equal (Guava's behaviour) — use `putCoalescing` for that.
 *
 * @example
 * ```ts
 * import { IntervalMap, NumberInterval } from "@xtandard/lib/interval";
 *
 * const tax = IntervalMap.of(NumberInterval.domain, [
 *   [NumberInterval.closedOpen(0, 10_000), 0],
 *   [NumberInterval.closedOpen(10_000, 40_000), 0.1],
 *   [NumberInterval.atLeast(40_000), 0.2],
 * ]);
 * tax.get(25_000); // 0.1
 * tax.get(-5); // undefined
 *
 * // put overwrites the overlapped part and splits what it cuts through:
 * const promo = tax.put(NumberInterval.closedOpen(5_000, 15_000), 0.05);
 * promo.toString();
 * // "{[0,5000) => 0, [5000,15000) => 0.05, [15000,40000) => 0.1, [40000,+Infinity) => 0.2}"
 * promo.getEntry(12_000)?.[0].toString(); // "[5000,15000)"
 * ```
 *
 * @example putCoalescing merges connected entries with an equal value
 * ```ts
 * import { IntegerInterval, IntervalMap } from "@xtandard/lib/interval";
 *
 * const shifts = IntervalMap.empty<number, string>(IntegerInterval.domain)
 *   .putCoalescing(IntegerInterval.closed(1, 5), "ana")
 *   .putCoalescing(IntegerInterval.closed(6, 9), "ana") // adjacent on the integers
 *   .putCoalescing(IntegerInterval.closed(10, 12), "bo");
 * shifts.toString(); // "{[1,9] => ana, [10,12] => bo}"
 * shifts.remove(IntegerInterval.closed(4, 6)).toString();
 * // "{[1,3] => ana, [7,9] => ana, [10,12] => bo}"
 * ```
 */
export class IntervalMap<T, V> implements Iterable<IntervalMapEntry<T, V>> {
  /** The domain that orders/steps/serializes the keys. */
  readonly domain: IntervalDomain<T>;
  /** The value equality used by `putCoalescing` and `equals` (default `Object.is`). */
  readonly valueEquals: (a: V, b: V) => boolean;
  /** Sorted by lower bound, pairwise disjoint, no empty intervals. */
  readonly #entries: readonly IntervalMapEntry<T, V>[];

  private constructor(
    domain: IntervalDomain<T>,
    entries: readonly IntervalMapEntry<T, V>[],
    valueEquals: (a: V, b: V) => boolean,
  ) {
    this.domain = domain;
    this.#entries = entries;
    this.valueEquals = valueEquals;
  }

  /**
   * A map built by `put`-ing each entry in order — so where entries overlap, the
   * later one wins on the overlapped part.
   */
  static of<T, V>(
    domain: IntervalDomain<T>,
    entries: Iterable<readonly [Interval<T>, V]> = [],
    options: IntervalMapOptions<V> = {},
  ): IntervalMap<T, V> {
    let map = IntervalMap.empty<T, V>(domain, options);
    for (const [interval, value] of entries) map = map.put(interval, value);

    return map;
  }

  /** The empty map. Give `V` explicitly: `IntervalMap.empty<number, string>(domain)`. */
  static empty<T, V>(
    domain: IntervalDomain<T>,
    options: IntervalMapOptions<V> = {},
  ): IntervalMap<T, V> {
    return new IntervalMap<T, V>(domain, [], options.valueEquals ?? Object.is);
  }

  #with(entries: readonly IntervalMapEntry<T, V>[]): IntervalMap<T, V> {
    return new IntervalMap(this.domain, entries, this.valueEquals);
  }

  /** Index of the first entry whose upper cut is strictly past `cut`. */
  #firstEndingAfter(cut: Cut<T>): number {
    return firstIndex(
      this.#entries.length,
      (i) => compareCut(this.domain, upperCut(this.domain, this.#entries[i]![0].upper), cut) > 0,
    );
  }

  // --- queries -------------------------------------------------------------

  /** `true` when the map has no entries. */
  get isEmpty(): boolean {
    return this.#entries.length === 0;
  }

  /** The number of entries (what iteration yields). */
  get size(): number {
    return this.#entries.length;
  }

  /** The `[interval, value]` entry whose interval contains `value`, or `undefined`. */
  getEntry(value: T): IntervalMapEntry<T, V> | undefined {
    if (this.domain.isValid && !this.domain.isValid(value)) return undefined;

    const above = cutAbove(value);
    const index = firstIndex(
      this.#entries.length,
      (i) => compareCut(this.domain, upperCut(this.domain, this.#entries[i]![0].upper), above) >= 0,
    );
    const entry = this.#entries[index];

    return entry?.[0].contains(value) ? entry : undefined;
  }

  /** The value mapped at `value`, or `undefined` if no entry covers it. */
  get(value: T): V | undefined {
    return this.getEntry(value)?.[1];
  }

  /** Whether some entry covers `value` (use it when `V` itself may be `undefined`). */
  has(value: T): boolean {
    return this.getEntry(value) !== undefined;
  }

  /** The smallest interval enclosing every entry; the empty interval for an empty map. */
  span(): Interval<T> {
    const first = this.#entries[0];
    const last = this.#entries.at(-1);

    return first && last ? first[0].span(last[0]) : Interval.blank(this.domain);
  }

  /** Every value of `T` that has an entry, as an {@link IntervalSet} (touching entries merge). */
  toIntervalSet(): IntervalSet<T> {
    return IntervalSet.of(this.domain, this.keys());
  }

  // --- updates -------------------------------------------------------------

  /**
   * Map every value of `interval` to `value`, overwriting the overlapped parts of
   * existing entries (an entry that straddles an end is split; the part outside
   * keeps its old value). An empty interval is a no-op.
   */
  put(interval: Interval<T>, value: V): IntervalMap<T, V> {
    if (interval.isEmpty) return this;

    const entries = this.remove(interval).#entries;
    const lower = lowerCut(this.domain, interval.lower);
    const at = firstIndex(
      entries.length,
      (i) => compareCut(this.domain, lowerCut(this.domain, entries[i]![0].lower), lower) > 0,
    );

    return this.#with([...entries.slice(0, at), [interval, value], ...entries.slice(at)]);
  }

  /**
   * Like {@link put}, but first widens `interval` to absorb the neighbouring
   * entries it overlaps or touches whose value is equal (per `valueEquals`) —
   * Guava's `putCoalescing`. Keeps the map minimal when equal values meet.
   */
  putCoalescing(interval: Interval<T>, value: V): IntervalMap<T, V> {
    if (interval.isEmpty) return this;

    let merged = interval;
    const lower = lowerCut(this.domain, interval.lower);
    const upper = upperCut(this.domain, interval.upper);
    // The entry starting before `interval`, and the last one starting at or before its end.
    const before =
      this.#entries[
        firstIndex(
          this.#entries.length,
          (i) =>
            compareCut(this.domain, lowerCut(this.domain, this.#entries[i]![0].lower), lower) >= 0,
        ) - 1
      ];
    const after =
      this.#entries[
        firstIndex(
          this.#entries.length,
          (i) =>
            compareCut(this.domain, lowerCut(this.domain, this.#entries[i]![0].lower), upper) > 0,
        ) - 1
      ];

    for (const neighbour of [before, after]) {
      if (
        neighbour &&
        neighbour[0].isConnected(interval) &&
        this.valueEquals(neighbour[1], value)
      ) {
        merged = merged.span(neighbour[0]);
      }
    }

    return this.put(merged, value);
  }

  /** Unmap every value of `interval`, splitting entries that straddle its ends. */
  remove(interval: Interval<T>): IntervalMap<T, V> {
    if (interval.isEmpty || this.isEmpty) return this;

    const start = this.#firstEndingAfter(lowerCut(this.domain, interval.lower));
    const upper = upperCut(this.domain, interval.upper);
    const out = this.#entries.slice(0, start);
    let i = start;

    for (; i < this.#entries.length; i++) {
      const [key, value] = this.#entries[i]!;
      if (compareCut(this.domain, lowerCut(this.domain, key.lower), upper) >= 0) break;

      for (const piece of subtractInterval(this.domain, key, interval)) out.push([piece, value]);
    }

    if (i === start) return this; // nothing overlapped

    return this.#with([...out, ...this.#entries.slice(i)]);
  }

  /** The entries restricted to `window` (each clipped to it); Guava's `subRangeMap`. */
  subMap(window: Interval<T>): IntervalMap<T, V> {
    if (window.isEmpty) return this.#with([]);

    const upper = upperCut(this.domain, window.upper);
    const out: IntervalMapEntry<T, V>[] = [];

    for (
      let i = this.#firstEndingAfter(lowerCut(this.domain, window.lower));
      i < this.#entries.length;
      i++
    ) {
      const [key, value] = this.#entries[i]!;
      if (compareCut(this.domain, lowerCut(this.domain, key.lower), upper) >= 0) break;

      const piece = key.intersection(window);
      if (!piece.isEmpty) out.push([piece, value]);
    }

    return this.#with(out);
  }

  // --- equality / iteration / serialization --------------------------------

  /** Same domain, same intervals, and equal values (per this map's `valueEquals`). */
  equals(other: IntervalMap<T, V>): boolean {
    if (this.domain.name !== other.domain.name) return false;
    if (this.#entries.length !== other.#entries.length) return false;

    return this.#entries.every(([key, value], i) => {
      const [otherKey, otherValue] = other.#entries[i]!;

      return sameInterval(this.domain, key, otherKey) && this.valueEquals(value, otherValue);
    });
  }

  /** The `[interval, value]` entries in ascending interval order. */
  [Symbol.iterator](): IterableIterator<IntervalMapEntry<T, V>> {
    return this.#entries[Symbol.iterator]();
  }

  /** The `[interval, value]` entries in ascending interval order (like `Map#entries`). */
  entries(): IterableIterator<IntervalMapEntry<T, V>> {
    return this.#entries[Symbol.iterator]();
  }

  /** The intervals in ascending order (like `Map#keys`). */
  *keys(): IterableIterator<Interval<T>> {
    for (const [key] of this.#entries) yield key;
  }

  /** The values in ascending interval order (like `Map#values`). */
  *values(): IterableIterator<V> {
    for (const [, value] of this.#entries) yield value;
  }

  /** A fresh array of the entries, in ascending interval order. */
  toArray(): IntervalMapEntry<T, V>[] {
    return [...this.#entries];
  }

  /**
   * Render as `{[0,10) => a, [10,20) => b}` (`{}` when empty). Intervals use
   * `Interval.format` (custom `±∞` tokens via options); values use `formatValue`
   * (default `String`).
   */
  format(options?: {
    negativeInfinity?: string;
    positiveInfinity?: string;
    formatValue?: (value: V) => string;
  }): string {
    const formatValue = options?.formatValue ?? String;
    const body = this.#entries
      .map(([key, value]) => `${key.format(options)} => ${formatValue(value)}`)
      .join(", ");

    return `{${body}}`;
  }

  /** Default `format()` (e.g. `"{[0,10) => a, [10,20) => b}"`). */
  toString(): string {
    return this.format();
  }
}
