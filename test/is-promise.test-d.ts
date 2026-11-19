/**
 * Compile-time narrowing assertions for `isPromise`: both branches must narrow,
 * including the else-branch of a `MaybePromise<T>` (concrete and generic `T`).
 * Each helper returns the value as narrowed in one branch of the guard.
 * Checked by `tsc --noEmit` (via `bun run check`); not run by the test runner.
 */
import type { Equal, Expect } from "type-testing";

import { isPromise } from "../src/is-promise.ts";
import type { MaybePromise } from "../src/types.ts";

// `MaybePromise<T>` (`T | PromiseLike<T>`): the else-branch is `T`.
declare const maybe: MaybePromise<string>;
const maybeThen = () => (isPromise(maybe) ? maybe : undefined);
const maybeElse = () => (isPromise(maybe) ? undefined : maybe);
export type _MaybeThenNarrowed = Expect<
  Equal<ReturnType<typeof maybeThen>, PromiseLike<string> | undefined>
>;
export type _MaybeElseNarrowed = Expect<Equal<ReturnType<typeof maybeElse>, string | undefined>>;

// A `T | Promise<T>` input keeps the full `Promise<T>` in the true branch.
declare const either: number | Promise<number>;
const eitherThen = () => (isPromise(either) ? either : undefined);
const eitherElse = () => (isPromise(either) ? undefined : either);
export type _EitherThen = Expect<Equal<ReturnType<typeof eitherThen>, Promise<number> | undefined>>;
export type _EitherElse = Expect<Equal<ReturnType<typeof eitherElse>, number | undefined>>;

// Generic `T`: the else-branch narrows to `T`, so no `as T` cast is needed.
function genericThen<T>(value: MaybePromise<T>) {
  if (isPromise(value)) return value;
  throw new Error("unreachable");
}
function genericElse<T>(value: MaybePromise<T>) {
  if (isPromise(value)) throw new Error("unreachable");
  return value;
}
export type _GenericThen = Expect<Equal<ReturnType<typeof genericThen<Date>>, PromiseLike<Date>>>;
export type _GenericElse = Expect<Equal<ReturnType<typeof genericElse<Date>>, Date>>;
