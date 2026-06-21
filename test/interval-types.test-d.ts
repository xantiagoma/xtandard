/**
 * Compile-time inference assertions for the public `xantiagoma/interval` types.
 * Statically checked by `tsc --noEmit` (via `bun run check`); not run by the
 * test runner. See CLAUDE.md → Testing for the `*.test-d.ts` convention.
 */
import type { Equal, Expect } from "type-testing";

import { defineIntervalType, type BoundIntervalType, type Interval } from "../src/interval.ts";
import {
  BigIntInterval,
  createOrdinalInterval,
  DateInterval,
  NumberInterval,
  StringInterval,
} from "../src/interval-domains.ts";

// --- defineIntervalType binds the element type T from its domain -------------

export type _Define = Expect<
  Equal<ReturnType<typeof defineIntervalType<number>>, BoundIntervalType<number>>
>;

// --- ready-made classes carry their element type ----------------------------

export type _NumberClass = Expect<Equal<typeof NumberInterval, BoundIntervalType<number>>>;
export type _NumberClosed = Expect<
  Equal<ReturnType<typeof NumberInterval.closed>, Interval<number>>
>;
export type _NumberInstance = Expect<Equal<InstanceType<typeof NumberInterval>, Interval<number>>>;
export type _BigInt = Expect<Equal<ReturnType<typeof BigIntInterval.atLeast>, Interval<bigint>>>;
export type _Date = Expect<Equal<ReturnType<typeof DateInterval.closed>, Interval<Date>>>;
export type _String = Expect<Equal<ReturnType<typeof StringInterval.open>, Interval<string>>>;

// --- createOrdinalInterval: labels drive index/label inference ---------------

const Size = createOrdinalInterval(["XS", "S", "M"] as const);

// the interval still operates on the integer index
export type _OrdinalClosed = Expect<Equal<ReturnType<typeof Size.closed>, Interval<number>>>;
// .index only accepts the known labels
export type _OrdinalIndexParam = Expect<Equal<Parameters<typeof Size.index>[0], "XS" | "S" | "M">>;
// .label maps back to a known label (or undefined out of range)
export type _OrdinalLabelReturn = Expect<
  Equal<ReturnType<typeof Size.label>, "XS" | "S" | "M" | undefined>
>;
// the stored label list keeps the literal union
export type _OrdinalLabels = Expect<Equal<typeof Size.labels, readonly ("XS" | "S" | "M")[]>>;
