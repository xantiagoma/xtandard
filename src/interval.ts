/**
 * A generic, immutable `Interval<T>` over any ordered type — modeled on Guava's
 * `Range` + `DiscreteDomain`. The core knows nothing about `T` except through an
 * injected {@link IntervalDomain} (a comparator, plus optional successor for
 * discrete domains, measure for `length()`, format/parse for strings, and the
 * domain's `±∞` values for the extended-real model).
 *
 * Bounds are per-side open or closed; either side may be unbounded (`±∞`). When a
 * domain declares `negativeInfinity`/`positiveInfinity` (e.g. `number` →
 * `±Infinity`), the bracket on an unbounded side is MEANINGFUL — the extended
 * real line `ℝ̄`: `[-Infinity,5]` includes `-∞`, `(-Infinity,5)` does not. Domains without
 * those values (Date, bigint, Instant, …) have no `±∞` element, so an unbounded
 * side is always open (the `(`/`)` is just notation).
 *
 * Discrete domains (those with `next`) are canonicalized to `[closed, open)` so
 * integer-style adjacency is exact (`[1,5] ∪ [6,10] = [1,10]`); continuous
 * domains keep bounds verbatim. String form: `[a,b]`, `(a,b)`, `[a,b)`,
 * `(-Infinity,5]`, `[-Infinity,+Infinity]`, `∅` (empty).
 *
 * Use {@link defineIntervalType} to bind a domain to a `new`-able class
 * (`NumberInterval`, …) whose instances are `instanceof Interval`.
 *
 * No `ts-pattern` here on purpose — this can be bundled into the web app.
 */

/** One endpoint. Unbounded ⇒ `±∞`; its `closed` flag matters only when the
 * domain declares that infinity as a value (else it is forced open). */
export type Bound<T> =
  | { readonly unbounded: true; readonly closed: boolean }
  | { readonly unbounded: false; readonly value: T; readonly closed: boolean };

/** Describes how to order, step, measure, and serialize values of `T`. */
export interface IntervalDomain<T> {
  readonly name: string;
  /** Total order: negative if `a < b`, zero if equal, positive if `a > b`. */
  compare(a: T, b: T): number;
  /**
   * Whether a value is a valid member — e.g. excludes `NaN` for numbers (`NaN`
   * isn't comparable). Absent ⇒ every value of `T` is valid. Checked by `contains`.
   */
  isValid?(value: T): boolean;
  /** The domain's `-∞` value (e.g. `-Infinity`). Enables includable lower `±∞`. */
  negativeInfinity?: T;
  /** The domain's `+∞` value (e.g. `Infinity`). Enables includable upper `±∞`. */
  positiveInfinity?: T;
  /** Successor. Presence marks the domain DISCRETE (this is the "epsilon"). */
  next?(value: T): T;
  /** Predecessor (optional companion to `next`). */
  prev?(value: T): T;
  /** Length of `[lower, upper]` in the domain's unit; enables `length()`. */
  measure?(lower: T, upper: T): number;
  /** Shift a value by a delta (same unit as `measure`); enables `fromStart`/… */
  add?(value: T, delta: number): T;
  /** Render one endpoint; enables `toString()`/`format()`. */
  format?(value: T): string;
  /** Parse one endpoint; enables `parseInterval()`. */
  parse?(text: string): T;
}

// --- internal cut model (a position strictly between values) ----------------

/**
 * A "cut" is a position on the line that sits strictly between values, à la
 * Guava's `Cut`. Representing both endpoints as cuts turns every open/closed,
 * bounded/unbounded comparison into a single total order, so the set operations
 * don't need per-bracket special cases. `belowAll`/`aboveAll` are the cuts past
 * either end; `below v` sits just left of `v`, `above v` just right of it.
 */
type Cut<T> =
  | { readonly kind: "belowAll" }
  | { readonly kind: "aboveAll" }
  | { readonly kind: "below"; readonly value: T }
  | { readonly kind: "above"; readonly value: T };

/**
 * The cut for a lower bound. An unbounded lower maps to its `-∞` value when the
 * domain has one (so the closed/open bracket orders correctly), else `belowAll`.
 */
function lowerCut<T>(domain: IntervalDomain<T>, bound: Bound<T>): Cut<T> {
  if (bound.unbounded) {
    if (domain.negativeInfinity === undefined) return { kind: "belowAll" };

    return bound.closed
      ? { kind: "below", value: domain.negativeInfinity }
      : { kind: "above", value: domain.negativeInfinity };
  }

  return bound.closed
    ? { kind: "below", value: bound.value }
    : { kind: "above", value: bound.value };
}

/**
 * The cut for an upper bound. An unbounded upper maps to its `+∞` value when the
 * domain has one (so the closed/open bracket orders correctly), else `aboveAll`.
 */
function upperCut<T>(domain: IntervalDomain<T>, bound: Bound<T>): Cut<T> {
  if (bound.unbounded) {
    if (domain.positiveInfinity === undefined) return { kind: "aboveAll" };

    return bound.closed
      ? { kind: "above", value: domain.positiveInfinity }
      : { kind: "below", value: domain.positiveInfinity };
  }

  return bound.closed
    ? { kind: "above", value: bound.value }
    : { kind: "below", value: bound.value };
}

/** Total order on cuts: negative if `a` is left of `b`, 0 if equal, positive if right. */
function compareCut<T>(domain: IntervalDomain<T>, a: Cut<T>, b: Cut<T>): number {
  if (a.kind === "belowAll") return b.kind === "belowAll" ? 0 : -1;
  if (a.kind === "aboveAll") return b.kind === "aboveAll" ? 0 : 1;
  if (b.kind === "belowAll") return 1;
  if (b.kind === "aboveAll") return -1;

  const c = domain.compare(a.value, b.value);

  if (a.kind === b.kind) return c;
  // mixed: `below v` sits just left of v, `above v` just right of v.
  if (a.kind === "below") return c <= 0 ? -1 : 1;

  return c < 0 ? -1 : 1;
}

/** Structural equality of two (already-canonical) bounds: same value + same bracket. */
function boundEquals<T>(domain: IntervalDomain<T>, a: Bound<T>, b: Bound<T>): boolean {
  if (a.unbounded || b.unbounded) {
    return a.unbounded === b.unbounded && a.closed === b.closed;
  }

  return domain.compare(a.value, b.value) === 0 && a.closed === b.closed;
}

/** Canonicalize discrete intervals to `[closed lower, open upper)`. */
function canonicalize<T>(
  domain: IntervalDomain<T>,
  lower: Bound<T>,
  upper: Bound<T>,
): readonly [Bound<T>, Bound<T>] {
  const step = domain.next;
  if (!step) return [lower, upper];

  const lo: Bound<T> =
    !lower.unbounded && !lower.closed
      ? { unbounded: false, value: step(lower.value), closed: true }
      : lower;

  const up: Bound<T> =
    !upper.unbounded && upper.closed
      ? { unbounded: false, value: step(upper.value), closed: false }
      : upper;

  return [lo, up];
}

/** Shared placeholder bounds for the empty interval (both sides open-unbounded). */
const OPEN_LOWER: Bound<never> = { unbounded: true, closed: false };
const OPEN_UPPER: Bound<never> = { unbounded: true, closed: false };

/**
 * An immutable interval over an ordered type `T`, with set algebra
 * (`union`/`intersection`/`difference`/…) decided entirely by an injected
 * {@link IntervalDomain}. Build instances with the static {@link Interval.of}
 * (or, more ergonomically, a domain-bound class from {@link defineIntervalType});
 * `new Interval(...)` is blocked because the constructor is `protected`. Every
 * operation returns a fresh `Interval` — nothing mutates in place.
 */
export class Interval<T> {
  /** The domain that orders/steps/serializes `T` (and decides discreteness). */
  readonly domain: IntervalDomain<T>;
  /** The lower endpoint (`unbounded` ⇒ `-∞`). */
  readonly lower: Bound<T>;
  /** The upper endpoint (`unbounded` ⇒ `+∞`). */
  readonly upper: Bound<T>;
  /** `true` for the empty interval (contains nothing). All ops guard on this. */
  readonly isEmpty: boolean;

  // Protected so domain-bound subclasses ({@link defineIntervalType}) can call
  // `super(...)`, but `new Interval(...)` is blocked — use `Interval.of`.
  protected constructor(
    domain: IntervalDomain<T>,
    lower: Bound<T>,
    upper: Bound<T>,
    isEmpty: boolean,
  ) {
    this.domain = domain;
    this.lower = lower;
    this.upper = upper;
    this.isEmpty = isEmpty;
  }

  /** The canonical builder: validates/canonicalizes bounds; invalid → empty. */
  static of<T>(domain: IntervalDomain<T>, lower: Bound<T>, upper: Bound<T>): Interval<T> {
    const [lo, up] = canonicalize(domain, lower, upper);

    if (compareCut(domain, lowerCut(domain, lo), upperCut(domain, up)) >= 0) {
      return Interval.blank(domain);
    }

    return new Interval(domain, lo, up, false);
  }

  /** The empty interval. (Named `blank` so bound subclasses can own `empty()`.) */
  static blank<T>(domain: IntervalDomain<T>): Interval<T> {
    return new Interval(domain, OPEN_LOWER, OPEN_UPPER, true);
  }

  // --- queries -------------------------------------------------------------

  /** `true` for `(-Infinity,+Infinity)` — unbounded on both sides (and not empty). */
  get isFull(): boolean {
    return !this.isEmpty && this.lower.unbounded && this.upper.unbounded;
  }

  /** `true` if the interval contains exactly one value (e.g. `[3,3]`). */
  get isPoint(): boolean {
    if (this.isEmpty || this.lower.unbounded || this.upper.unbounded) return false;

    if (this.domain.next) {
      return this.domain.compare(this.domain.next(this.lower.value), this.upper.value) === 0;
    }

    return (
      this.lower.closed &&
      this.upper.closed &&
      this.domain.compare(this.lower.value, this.upper.value) === 0
    );
  }

  /**
   * `true` if the domain is DISCRETE (defines `next` — the "epsilon"): adjacent
   * ranges merge gap-free (`[1,5] ∪ [6,10] = [1,10]`) and `length()` counts
   * elements. `false` ⇒ CONTINUOUS: bounds are verbatim, adjacency only on exact
   * touch, `length()` is a measure. A property of the domain, surfaced here for
   * convenience.
   */
  get isDiscrete(): boolean {
    return this.domain.next !== undefined;
  }

  /** Whether the interval has a finite lower endpoint (not `-∞`, not empty). */
  hasLowerBound(): boolean {
    return !this.isEmpty && !this.lower.unbounded;
  }

  /** Whether the interval has a finite upper endpoint (not `+∞`, not empty). */
  hasUpperBound(): boolean {
    return !this.isEmpty && !this.upper.unbounded;
  }

  /** The finite lower value, or `null` if empty/unbounded. */
  lowerValue(): T | null {
    return !this.isEmpty && !this.lower.unbounded ? this.lower.value : null;
  }

  /** The finite upper value, or `null` if empty/unbounded. */
  upperValue(): T | null {
    return !this.isEmpty && !this.upper.unbounded ? this.upper.value : null;
  }

  /** Whether `value` is a member (respects open/closed and `domain.isValid`). */
  contains(value: T): boolean {
    if (this.isEmpty) return false;
    if (this.domain.isValid && !this.domain.isValid(value)) return false;

    if (this.lower.unbounded) {
      // Only `-∞` itself can fail an unbounded lower — and only when open.
      const negInf = this.domain.negativeInfinity;
      if (negInf !== undefined && !this.lower.closed && this.domain.compare(value, negInf) === 0) {
        return false;
      }
    } else {
      const c = this.domain.compare(value, this.lower.value);
      if (this.lower.closed ? c < 0 : c <= 0) return false;
    }

    if (this.upper.unbounded) {
      const posInf = this.domain.positiveInfinity;
      if (posInf !== undefined && !this.upper.closed && this.domain.compare(value, posInf) === 0) {
        return false;
      }
    } else {
      const c = this.domain.compare(value, this.upper.value);
      if (this.upper.closed ? c > 0 : c >= 0) return false;
    }

    return true;
  }

  /** Whether `other` is fully contained in this interval (`other ⊆ this`). */
  encloses(other: Interval<T>): boolean {
    if (other.isEmpty) return true;
    if (this.isEmpty) return false;

    return (
      compareCut(
        this.domain,
        lowerCut(this.domain, this.lower),
        lowerCut(this.domain, other.lower),
      ) <= 0 &&
      compareCut(
        this.domain,
        upperCut(this.domain, other.upper),
        upperCut(this.domain, this.upper),
      ) <= 0
    );
  }

  /** Whether the two intervals share at least one value (intersection non-empty). */
  overlaps(other: Interval<T>): boolean {
    return !this.intersection(other).isEmpty;
  }

  /** Whether `union` would yield a single interval — they overlap OR are adjacent. */
  isConnected(other: Interval<T>): boolean {
    if (this.isEmpty || other.isEmpty) return false;

    return (
      compareCut(
        this.domain,
        lowerCut(this.domain, this.lower),
        upperCut(this.domain, other.upper),
      ) <= 0 &&
      compareCut(
        this.domain,
        lowerCut(this.domain, other.lower),
        upperCut(this.domain, this.upper),
      ) <= 0
    );
  }

  /** Whether they touch with no gap and no overlap (connected but disjoint). */
  isAdjacent(other: Interval<T>): boolean {
    return this.isConnected(other) && !this.overlaps(other);
  }

  /** Whether this interval ends at or before `other` begins (no value of this is after other). */
  isBefore(other: Interval<T>): boolean {
    if (this.isEmpty || other.isEmpty) return false;

    return (
      compareCut(
        this.domain,
        upperCut(this.domain, this.upper),
        lowerCut(this.domain, other.lower),
      ) <= 0
    );
  }

  /** Whether this interval begins at or after `other` ends. */
  isAfter(other: Interval<T>): boolean {
    return other.isBefore(this);
  }

  // Set-composition predicates (mirroring JS `Set`).

  /** Whether this is a superset of `other` (alias of `encloses`). */
  isSupersetOf(other: Interval<T>): boolean {
    return this.encloses(other);
  }

  /** Whether this is a subset of `other` (`this ⊆ other`). */
  isSubsetOf(other: Interval<T>): boolean {
    return other.encloses(this);
  }

  /** Whether the two intervals share no values (no overlap). */
  isDisjointFrom(other: Interval<T>): boolean {
    return !this.overlaps(other);
  }

  // --- set operations ------------------------------------------------------

  /** The overlap of the two intervals (empty if they are disjoint). */
  intersection(other: Interval<T>): Interval<T> {
    if (this.isEmpty || other.isEmpty) return Interval.blank(this.domain);

    const lo =
      compareCut(
        this.domain,
        lowerCut(this.domain, this.lower),
        lowerCut(this.domain, other.lower),
      ) >= 0
        ? this.lower
        : other.lower;
    const up =
      compareCut(
        this.domain,
        upperCut(this.domain, this.upper),
        upperCut(this.domain, other.upper),
      ) <= 0
        ? this.upper
        : other.upper;

    return Interval.of(this.domain, lo, up);
  }

  /** The smallest interval enclosing both — even across a gap (unlike `union`). */
  span(other: Interval<T>): Interval<T> {
    if (this.isEmpty) return other;
    if (other.isEmpty) return this;

    const lo =
      compareCut(
        this.domain,
        lowerCut(this.domain, this.lower),
        lowerCut(this.domain, other.lower),
      ) <= 0
        ? this.lower
        : other.lower;
    const up =
      compareCut(
        this.domain,
        upperCut(this.domain, this.upper),
        upperCut(this.domain, other.upper),
      ) >= 0
        ? this.upper
        : other.upper;

    return Interval.of(this.domain, lo, up);
  }

  /** Merged interval, or `null` if disjoint with a gap (not connected). */
  union(other: Interval<T>): Interval<T> | null {
    if (this.isEmpty) return other;
    if (other.isEmpty) return this;
    if (!this.isConnected(other)) return null;

    return this.span(other);
  }

  /** The open space between two disjoint intervals, or `null` if connected. */
  gap(other: Interval<T>): Interval<T> | null {
    if (this.isEmpty || other.isEmpty || this.isConnected(other)) return null;

    const thisFirst =
      compareCut(
        this.domain,
        upperCut(this.domain, this.upper),
        lowerCut(this.domain, other.lower),
      ) <= 0;
    const left = thisFirst ? this : other;
    const right = thisFirst ? other : this;

    const gapLower: Bound<T> = left.upper.unbounded
      ? { unbounded: true, closed: false }
      : { unbounded: false, value: left.upper.value, closed: !left.upper.closed };
    const gapUpper: Bound<T> = right.lower.unbounded
      ? { unbounded: true, closed: false }
      : { unbounded: false, value: right.lower.value, closed: !right.lower.closed };

    return Interval.of(this.domain, gapLower, gapUpper);
  }

  /** `this \ other` — 0, 1, or 2 pieces. */
  difference(other: Interval<T>): Interval<T>[] {
    if (this.isEmpty) return [];
    if (other.isEmpty) return [this];

    const result: Interval<T>[] = [];

    if (!other.lower.unbounded) {
      const leftUpper: Bound<T> = {
        unbounded: false,
        value: other.lower.value,
        closed: !other.lower.closed,
      };
      const left = this.intersection(
        Interval.of(this.domain, { unbounded: true, closed: false }, leftUpper),
      );

      if (!left.isEmpty) result.push(left);
    }

    if (!other.upper.unbounded) {
      const rightLower: Bound<T> = {
        unbounded: false,
        value: other.upper.value,
        closed: !other.upper.closed,
      };
      const right = this.intersection(
        Interval.of(this.domain, rightLower, { unbounded: true, closed: false }),
      );

      if (!right.isEmpty) result.push(right);
    }

    return result;
  }

  /** Parts in exactly one of the two intervals (merged + sorted). */
  symmetricDifference(other: Interval<T>): Interval<T>[] {
    return mergeIntervals(this.domain, [...this.difference(other), ...other.difference(this)]);
  }

  // --- measure / equality / serialization ----------------------------------

  /**
   * Size via `domain.measure`: a continuous magnitude (e.g. `[1,5]` → 4) or, for
   * discrete domains, the element count (e.g. `[1,5]` integers → 5). `0` if empty;
   * `null` if unbounded or the domain has no `measure`.
   */
  length(): number | null {
    if (this.isEmpty) return 0;
    if (this.lower.unbounded || this.upper.unbounded || !this.domain.measure) return null;

    return this.domain.measure(this.lower.value, this.upper.value);
  }

  /** Midpoint value, or `null` if empty/unbounded or the domain lacks add+measure. */
  middle(): T | null {
    if (this.isEmpty || this.lower.unbounded || this.upper.unbounded) return null;
    if (!this.domain.add || !this.domain.measure) return null;

    return this.domain.add(
      this.lower.value,
      this.domain.measure(this.lower.value, this.upper.value) / 2,
    );
  }

  /** A copy with a new lower endpoint (Dart `setStart`). */
  withStart(value: T, closed: boolean): Interval<T> {
    return Interval.of(this.domain, { unbounded: false, value, closed }, this.upper);
  }

  /** A copy with a new upper endpoint (Dart `setEnd`). */
  withEnd(value: T, closed: boolean): Interval<T> {
    return Interval.of(this.domain, this.lower, { unbounded: false, value, closed });
  }

  /** Structural equality (canonical, so `(0,5] == [1,5]` on a discrete domain). */
  equals(other: Interval<T>): boolean {
    if (this.domain.name !== other.domain.name) return false;
    if (this.isEmpty || other.isEmpty) return this.isEmpty === other.isEmpty;

    return (
      boundEquals(this.domain, this.lower, other.lower) &&
      boundEquals(this.domain, this.upper, other.upper)
    );
  }

  /** Render as `[a,b)` / `(-Infinity,5]` / `∅`. Discrete intervals show the friendly
   * closed-closed form; pass custom `±∞` tokens via options. */
  format(options?: { negativeInfinity?: string; positiveInfinity?: string }): string {
    if (this.isEmpty) return "∅";

    const neg = options?.negativeInfinity ?? "-Infinity";
    const pos = options?.positiveInfinity ?? "+Infinity";
    const render = this.domain.format ?? ((value: T) => String(value));
    // Discrete intervals are stored canonical [closed, open); display the
    // friendlier closed-closed form [lo, prev(hi)] (e.g. [1,5], not [1,6)).
    const prev = this.domain.next ? this.domain.prev : undefined;

    const open = this.lower.closed ? "[" : "(";
    const lo = this.lower.unbounded ? neg : render(this.lower.value);

    if (this.upper.unbounded) {
      return `${open}${lo},${pos}${this.upper.closed ? "]" : ")"}`;
    }

    if (prev && !this.upper.closed) return `${open}${lo},${render(prev(this.upper.value))}]`;

    const up = render(this.upper.value);

    return `${open}${lo},${up}${this.upper.closed ? "]" : ")"}`;
  }

  /** Default `format()` (e.g. `"[1,5)"`). */
  toString(): string {
    return this.format();
  }
}

/** Return `domain.add`, or throw if the domain can't shift values (no `add` hook). */
function requireAdd<T>(domain: IntervalDomain<T>): (value: T, delta: number) => T {
  if (!domain.add) {
    throw new Error(`interval domain "${domain.name}" has no add(); cannot build from length`);
  }

  return domain.add;
}

/** Merge a bag of intervals into the minimal sorted set of disjoint pieces. */
export function mergeIntervals<T>(
  domain: IntervalDomain<T>,
  intervals: readonly Interval<T>[],
): Interval<T>[] {
  const sorted = intervals
    .filter((interval) => !interval.isEmpty)
    .sort((a, b) => compareCut(domain, lowerCut(domain, a.lower), lowerCut(domain, b.lower)));

  const out: Interval<T>[] = [];

  for (const current of sorted) {
    const last = out.at(-1);

    if (last && last.isConnected(current)) {
      out[out.length - 1] = last.span(current);
    } else {
      out.push(current);
    }
  }

  return out;
}

const INFINITY_TOKEN = /^[+-]?(inf|infinity|∞)$/i;

/**
 * Parse `[a,b)`, `(-Infinity,5]`, `∅`, etc. into an `Interval<T>` via `domain.parse`.
 * The unbounded token is lenient — `inf` / `infinity` / `∞`, any case, with an
 * optional `+`/`-` sign — but `toString()` always emits the canonical `±Infinity`.
 */
export function parseInterval<T>(domain: IntervalDomain<T>, text: string): Interval<T> {
  const trimmed = text.trim();

  if (trimmed === "" || trimmed === "∅") return Interval.blank(domain);

  const open = trimmed[0];
  const close = trimmed.at(-1);

  if ((open !== "[" && open !== "(") || (close !== "]" && close !== ")")) {
    throw new Error(`invalid interval "${text}": must start with [ or ( and end with ] or )`);
  }

  const body = trimmed.slice(1, -1);
  const comma = body.indexOf(",");

  if (comma < 0) throw new Error(`invalid interval "${text}": missing comma`);

  const lowerText = body.slice(0, comma).trim();
  const upperText = body.slice(comma + 1).trim();

  // A `[`/`]` on `±∞` only sticks if the domain has that infinity value.
  const lower: Bound<T> = INFINITY_TOKEN.test(lowerText)
    ? { unbounded: true, closed: open === "[" && domain.negativeInfinity !== undefined }
    : { unbounded: false, value: parseValue(domain, lowerText), closed: open === "[" };
  const upper: Bound<T> = INFINITY_TOKEN.test(upperText)
    ? { unbounded: true, closed: close === "]" && domain.positiveInfinity !== undefined }
    : { unbounded: false, value: parseValue(domain, upperText), closed: close === "]" };

  return Interval.of(domain, lower, upper);
}

/** Parse a single endpoint via `domain.parse`, or throw if the domain has none. */
function parseValue<T>(domain: IntervalDomain<T>, text: string): T {
  if (!domain.parse) throw new Error(`interval domain "${domain.name}" has no parse()`);

  return domain.parse(text);
}

/**
 * Friendly constructor spec — explicit brackets, NO defaults. Give a side via
 * its flat keys (`start` + `startClose`, both required together), or omit it
 * entirely for an unbounded (`±∞`) side. Supplying `start` without `startClose`
 * (or `end` without `endClose`) is a compile error.
 */
export type IntervalSpec<T> = (
  | { start: T; startClose: boolean }
  | { start?: never; startClose?: never }
) &
  ({ end: T; endClose: boolean } | { end?: never; endClose?: never });

function specLower<T>(spec: IntervalSpec<T>): Bound<T> {
  // Guard on `startClose` (not `start`): the union ties them together, and the
  // boolean-vs-never discriminant narrows BOTH `start` and `startClose`.
  return spec.startClose === undefined
    ? { unbounded: true, closed: false }
    : { unbounded: false, value: spec.start, closed: spec.startClose };
}

function specUpper<T>(spec: IntervalSpec<T>): Bound<T> {
  return spec.endClose === undefined
    ? { unbounded: true, closed: false }
    : { unbounded: false, value: spec.end, closed: spec.endClose };
}

/**
 * The shape of a domain-bound interval CLASS produced by {@link defineIntervalType}:
 * a `new`-able constructor plus the static factory methods. The explicit type is
 * the public return type of `defineIntervalType` (not the local anonymous class)
 * so `.d.ts` generation never has to synthesize an inline type literal for it.
 *
 * Instances and factory results are typed as the base `Interval<T>` (still
 * `instanceof Interval` and `instanceof` the bound class at runtime).
 */
export interface BoundIntervalType<T> {
  /**
   * Construct from a {@link IntervalSpec} (explicit brackets, omit a side for
   * unbounded) or wrap an existing {@link Interval}. No argument ⇒ `(-∞,+∞)`.
   */
  new (spec?: IntervalSpec<T> | Interval<T>): Interval<T>;
  /** The {@link IntervalDomain} this class is bound to. */
  readonly domain: IntervalDomain<T>;
  /** `[a, b]` — both endpoints included. */
  closed(a: T, b: T): Interval<T>;
  /** `(a, b)` — both endpoints excluded. */
  open(a: T, b: T): Interval<T>;
  /** `[a, b)` — lower included, upper excluded (the canonical half-open form). */
  closedOpen(a: T, b: T): Interval<T>;
  /** `(a, b]` — lower excluded, upper included. */
  openClosed(a: T, b: T): Interval<T>;
  /** `[value, value]` — the single-element interval. */
  point(value: T): Interval<T>;
  /** `[a, +∞)` — everything `≥ a`. */
  atLeast(a: T): Interval<T>;
  /** `(a, +∞)` — everything `> a`. */
  greaterThan(a: T): Interval<T>;
  /** `(-∞, b]` — everything `≤ b`. */
  atMost(b: T): Interval<T>;
  /** `(-∞, b)` — everything `< b`. */
  lessThan(b: T): Interval<T>;
  /** `(-∞, +∞)` — the full interval (open infinities). */
  all(): Interval<T>;
  /** The empty interval `∅` (contains nothing). */
  empty(): Interval<T>;
  /** `[start, start + length)` — half-open, needs `domain.add`. */
  fromStart(start: T, length: number): Interval<T>;
  /** `[end - length, end)` — half-open, needs `domain.add`. */
  fromEnd(end: T, length: number): Interval<T>;
  /** `[center - length/2, center + length/2)` — half-open, needs `domain.add`. */
  fromCenter(center: T, length: number): Interval<T>;
  /** Parse a string form (`"[1,5)"`, `"(-Infinity,5]"`, `"∅"`) via `domain.parse`. */
  parse(text: string): Interval<T>;
}

/**
 * Bind a {@link IntervalDomain} to a concrete, `new`-able interval CLASS that
 * extends {@link Interval}, so instances are `instanceof Interval` (and
 * `instanceof` the bound class):
 *
 *   const NumberInterval = defineIntervalType(numberDomain);
 *   type NumberInterval = InstanceType<typeof NumberInterval>;
 *
 *   const r = new NumberInterval({ start: 5, startClose: true, end: 6, endClose: false }); // [5,6)
 *   r instanceof NumberInterval;        // true
 *   r instanceof Interval;              // true
 *   NumberInterval.closedOpen(5, 6);    // static; also an instance of both
 *   NumberInterval.parse("(-Infinity,5]");
 *
 * Operations inherited from `Interval` (`union`, `intersection`, …) return base
 * `Interval<T>` values (still `instanceof Interval`).
 */
export function defineIntervalType<T>(domain: IntervalDomain<T>): BoundIntervalType<T> {
  return class BoundInterval extends Interval<T> {
    static readonly domain: IntervalDomain<T> = domain;

    constructor(spec: IntervalSpec<T> | Interval<T> = {}) {
      const built =
        spec instanceof Interval ? spec : Interval.of(domain, specLower(spec), specUpper(spec));

      super(domain, built.lower, built.upper, built.isEmpty);
    }

    static closed(a: T, b: T): BoundInterval {
      return new BoundInterval({ start: a, startClose: true, end: b, endClose: true });
    }

    static open(a: T, b: T): BoundInterval {
      return new BoundInterval({ start: a, startClose: false, end: b, endClose: false });
    }

    static closedOpen(a: T, b: T): BoundInterval {
      return new BoundInterval({ start: a, startClose: true, end: b, endClose: false });
    }

    static openClosed(a: T, b: T): BoundInterval {
      return new BoundInterval({ start: a, startClose: false, end: b, endClose: true });
    }

    static point(value: T): BoundInterval {
      return new BoundInterval({ start: value, startClose: true, end: value, endClose: true });
    }

    static atLeast(a: T): BoundInterval {
      return new BoundInterval({ start: a, startClose: true });
    }

    static greaterThan(a: T): BoundInterval {
      return new BoundInterval({ start: a, startClose: false });
    }

    static atMost(b: T): BoundInterval {
      return new BoundInterval({ end: b, endClose: true });
    }

    static lessThan(b: T): BoundInterval {
      return new BoundInterval({ end: b, endClose: false });
    }

    static all(): BoundInterval {
      return new BoundInterval({});
    }

    static empty(): BoundInterval {
      return new BoundInterval(Interval.blank(domain));
    }

    static fromStart(start: T, length: number): BoundInterval {
      const add = requireAdd(domain);

      return new BoundInterval({
        start,
        startClose: true,
        end: add(start, length),
        endClose: false,
      });
    }

    static fromEnd(end: T, length: number): BoundInterval {
      const add = requireAdd(domain);

      return new BoundInterval({
        start: add(end, -length),
        startClose: true,
        end,
        endClose: false,
      });
    }

    static fromCenter(center: T, length: number): BoundInterval {
      const add = requireAdd(domain);

      return new BoundInterval({
        start: add(center, -length / 2),
        startClose: true,
        end: add(center, length / 2),
        endClose: false,
      });
    }

    static parse(text: string): BoundInterval {
      return new BoundInterval(parseInterval(domain, text));
    }
  };
}
