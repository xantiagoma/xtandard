# Sync/Async-Adaptive Utilities

How to write utilities that are **as synchronous as their inputs**: pass all-sync
functions and you get plain values back (no `await`, no microtasks); make any
piece async — even one stage — and results become Promises, **reflected in the
types**.

Used by: [`createCursorCodec`](../src/cursor-codec.ts),
[`createPaginator`](../src/pagination.ts), [`tryCatch`](../src/try-catch.ts),
[`collect`](../src/collect.ts), [`enumerate`](../src/enumerate.ts).

## Background

- **The problem** is what Bob Nystrom's ["What Color is Your
  Function?"](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/)
  describes: async is viral. One async dependency forces `async` on every
  caller, and an `async` wrapper around sync logic taxes it with pointless
  microtasks.
- **The objection** is "releasing Zalgo" (Isaac Schlueter): APIs that are
  _unpredictably_ sometimes-sync, sometimes-async are bug factories.
- **The resolution**: determine asyncness **per instance, at construction
  time, visible in the types**. A given codec/paginator/predicate is always
  one color; callers never guess. This is effect polymorphism over
  `MaybePromise`, not Zalgo.

For FP readers: `chainMaybePromise` is monadic `flatMap` where the monad is
`Identity | Promise`.

## The Rules

1. **Construction-time color.** Factories and combinators decide sync vs async
   from their _inputs' types_, once. Never flip color per call based on data.
2. **Types tell the truth.** All-sync inputs → sync return types. Anything
   async → `Promise`/`MaybePromise` return types. Use overloads (sync overload
   first) so TypeScript picks the precise signature.
3. **Sync stays sync.** The sync path must never touch the microtask queue —
   no `async` keyword on the implementation, no `await`, no `Promise.resolve`
   wrapping. Compose with `chainMaybePromise` / `isPromise` instead.
4. **`await` always works.** Because `await` on a plain value is a no-op,
   callers who don't care about the distinction can always write `await` and
   stay correct, whatever the color.
5. **Throw programmer errors synchronously.** Misconfiguration (missing
   capability, invalid options) throws immediately in both colors. Only
   _data_ errors follow the value's color (sync throw vs rejected Promise).

## Building Blocks (all in core)

```ts
import type { MaybePromise } from "@xtandard/lib"; // T | Promise<T>
import { isPromise, chainMaybePromise, resolveMaybePromise } from "@xtandard/lib";
```

- `isPromise(value)` — thenable guard; the runtime color test.
- `chainMaybePromise(value, fn)` — apply `fn` now if `value` is plain, `.then`
  it if it's a Promise. The composition primitive; an all-sync chain never
  schedules a microtask.
- `resolveMaybePromise(value)` — always-async normalizer, for the boundary
  where you _want_ a Promise (e.g. feeding TanStack Query).

## Recipe 1 — Adaptive factory (the codec/paginator shape)

Three pieces: paired option types, paired result types, overloads + one
implementation in the loosest types.

```ts
// 1. Option types: a strict-sync variant and a MaybePromise variant
export type ThingOptionsSync<T> = { transform?: (data: T) => string };
export type ThingOptions<T> = { transform?: (data: T) => MaybePromise<string> };

// 2. Result types mirroring them
export type Thing<T> = { run: (data: T) => string };
export type ThingMaybeAsync<T> = { run: (data: T) => MaybePromise<string> };

// 3. Overloads — sync FIRST (TS picks the first match), impl in loose types
export function createThing<T>(options?: ThingOptionsSync<T>): Thing<T>;
export function createThing<T>(options: ThingOptions<T>): ThingMaybeAsync<T>;
export function createThing<T>(options: ThingOptions<T> = {}): ThingMaybeAsync<T> {
  const { transform = JSON.stringify } = options;
  return { run: (data) => chainMaybePromise(transform(data), postProcess) };
}
```

Why this works: a sync function `(d) => string` is assignable to
`(d) => MaybePromise<string>` (covariant return), so sync configs match both
overloads — and TypeScript takes the first. An `async` function only matches
the second. The sync caller gets `string`, the async caller gets honest types,
and there is exactly one implementation.

### Variant: distributive conditional return

For a single function (no factory), a conditional return type can replace the
overload pair and even handles `MaybePromise` unions precisely, because
conditional types distribute over unions — see `tryCatch`:

```ts
type IsAny<T> = 0 extends 1 & T ? true : false;

export type TryCatchReturn<R, E = Error> =
  IsAny<R> extends true
    ? Result<R, E> // any guard — JSON.parse etc.
    : [R] extends [never]
      ? Result<never, E> // never guard — function that always throws
      : R extends PromiseLike<infer U>
        ? Promise<Result<U, E>> // () => Promise<T>  → Promise<Result<T>>
        : Result<R, E>; // () => T           → Result<T>
// () => MaybePromise<T> distributes to Result<T> | Promise<Result<T>> — exact.

export function tryCatch<R, E = Error>(fn: () => R): TryCatchReturn<R, E>;
```

Two guards matter, both for inputs that poison distribution:

- **`never`** (a function that always throws): a distributive conditional over
  `never` collapses the whole return type to `never`. Guard with the
  non-distributive `[R] extends [never]`.
- **`any`** (e.g. `() => JSON.parse(...)`): `any` distributes into _both_
  branches, producing `Result<any> | Promise<Result<any>>` — which is not
  destructurable. Detect with the `0 extends 1 & T` trick and short-circuit.

Also add a final **catch-all union overload** (`(input: A | B) => loose`) —
without it, a value typed as a _union of the overload parameter types_ fails
overload resolution entirely (`collect`, `enumerate`, and `tryCatch` all
carry one).

> **Make sure your type assertions are actually checked.** These bugs shipped
> green because `tsconfig.json` originally only included `src/` — the
> `expectTypeOf` tests were never typechecked. Include `test/**` in the
> tsconfig that `check` runs.

### Capability tiers

When different parts of the config affect different outputs independently,
add a middle overload instead of collapsing everything to one async-ness.
`createPaginator` has three tiers because `cursorFor`'s color depends only on
the codec while `paginate`'s depends on fetchers _and_ codec:

| Config                      | `paginate()`                 | `cursorFor()`          |
| --------------------------- | ---------------------------- | ---------------------- |
| sync fetchers + sync codec  | `Paginated<T>`               | `string`               |
| async fetchers + sync codec | `MaybePromise<Paginated<T>>` | `string`               |
| async codec anywhere        | `MaybePromise<Paginated<T>>` | `MaybePromise<string>` |

The payoff: downstream sync-only consumers (`toRelayConnection` needs a sync
`cursorFor`) keep compiling in the common async-fetcher case, and break — at
compile time, with a clear error — only when someone actually introduces an
async codec.

## Recipe 2 — Adaptive combinator (the rule/predicate shape)

For variadic/iterative logic (combinators over many functions), walk
synchronously and **escape to an async closure at the first Promise**:

```ts
export function all<TData>(...rules: Array<(d: TData) => boolean>): (d: TData) => boolean;
export function all<TData>(
  ...rules: Array<(d: TData) => MaybePromise<boolean>>
): (d: TData) => MaybePromise<boolean>;
export function all<TData>(...rules: Array<(d: TData) => MaybePromise<boolean>>) {
  return (data: TData): MaybePromise<boolean> => {
    for (const [index, rule] of rules.entries()) {
      const result = rule(data);
      if (isPromise(result)) {
        // first Promise seen: hand the rest to an async closure
        return (async () => {
          if (!(await result)) return false;
          for (const rest of rules.slice(index + 1)) {
            if (!(await rest(data))) return false;
          }
          return true;
        })();
      }
      if (!result) return false; // sync short-circuit, zero microtasks
    }
    return true;
  };
}
```

Properties to preserve: short-circuiting works in both colors, evaluation
order is identical in both colors, and the sync prefix of a mixed list still
runs synchronously.

### Joining parallel values

`Promise.all` only when something actually is a Promise:

```ts
const a = encode(x);
const b = encode(y);
return isPromise(a) || isPromise(b)
  ? Promise.all([a, b]).then(([a, b]) => use(a, b))
  : use(a as string, b as string);
```

## Gotchas

- **Generic narrowing needs a cast.** `isPromise(value)` can't narrow
  `MaybePromise<T>` to `T` in the else-branch when `T` is a type parameter
  (TS can't subtract from a generic union). Write `fn(value as T)` — see
  `chainMaybePromise` itself.
- **Overload order matters.** Sync overload first, loosest last. The
  implementation signature is not callable; make it the loosest shape.
- **Don't mark the implementation `async`.** One `async` keyword silently
  re-colors every call. The implementation composes with `chainMaybePromise`
  only. Same for stray `await`s and `Promise.resolve()` wraps.
- **Watch `.then`-flattening.** `chainMaybePromise` flattens like `flatMap` —
  a `fn` returning `Promise<R>` over a sync value yields `Promise<R>`, not
  `Promise<Promise<R>>`. That's what you want; don't "fix" it.
- **Mutating callbacks**: a callback inside `chainMaybePromise` may run
  synchronously _or_ later. Don't close over mutable state that callers can
  change between call and settlement.
- **Error semantics shift.** Replacing `async function` with adaptive
  composition turns pre-fetch validation errors from rejected Promises into
  sync throws. Tests using `.rejects.toThrow` for those must become
  `expect(() => ...).toThrow` (this bit us in `pagination.test.ts`).
- **Boundary APIs that require Promises** (TanStack Query `queryFn`, etc.):
  normalize at the edge with `Promise.resolve(adaptiveCall())` — never inside
  the adaptive code.

## Testing Checklist

Test both colors, both at runtime and at the type level (vitest's
`expectTypeOf`). Two-color test blocks live in each util's own test file
(repo convention: test file matches source file) — see the
"sync/async adaptive" describes in [test/pagination.test.ts](../test/pagination.test.ts),
[test/cursor-codec.test.ts](../test/cursor-codec.test.ts), and
[test/resolve-maybe-promise.test.ts](../test/resolve-maybe-promise.test.ts).

```ts
// runtime: sync path returns a plain value
const result = thing.run(data);
expect(isPromise(result)).toBe(false);

// types: overload picked the sync signature
expectTypeOf(result).toEqualTypeOf<string>();

// runtime + types: one async stage flips the color
const asyncThing = createThing({ transform: async (d) => "..." });
expect(isPromise(asyncThing.run(data))).toBe(true);
```

- [ ] All-sync config: result is **not** a Promise (`isPromise` false) and the
      sync type is inferred (`expectTypeOf`).
- [ ] One async stage: result **is** a Promise; loose type inferred.
- [ ] Mixed configs hit the intended middle tier (if any).
- [ ] Behavior is identical in both colors (run the same assertions through
      both, `await` works on each).
- [ ] Config errors throw synchronously in both colors.
- [ ] Short-circuit/ordering semantics match in both colors (combinators).

## When NOT to use it

- **Inherently async work** (network, fs, timers): just be async. Adaptive
  machinery with no possible sync caller is complexity for nothing.
- **The color is structural, chosen by the caller's syntax.**
  `defer`/`deferSync` stay explicit because they implement different disposal
  protocols (`Symbol.asyncDispose` vs `Symbol.dispose`) consumed by different
  syntax (`await using` vs `using`) — there is no single implementation that
  serves both.
- **The "async version" has genuinely different semantics.** `enumerateAsync`
  survives alongside adaptive `enumerate` because `for await` _awaits Promise
  values inside a sync iterable_ — that's a behavior choice, not a color.
  (`tryCatchSync` had no such distinction — the adaptive `tryCatch` subsumes
  it entirely, so it's `@deprecated` and kept only for backwards
  compatibility.)
- **Hot one-liners** where two tiny separate functions are clearer than
  overload machinery.

Rule of thumb: adapt when one _implementation_ genuinely serves both colors
and callers plug in their own functions (factories, combinators, pipelines).

## Migration checklist (making an existing util adaptive)

1. Widen callback option types to return `MaybePromise<...>`; add a
   strict-sync options type alongside.
2. Add paired result types (sync + `MaybeAsync`).
3. Add overloads: sync → sync, (middle tiers), loosest → loosest.
4. De-`async` the implementation: replace `await` chains with
   `chainMaybePromise`, parallel `await`s with the `isPromise`-guarded
   `Promise.all` join, loops with the escape-to-async-closure walk.
5. Keep programmer-error `throw`s outside the chains so they stay sync.
6. Re-check tests for `.rejects` assertions that must become sync `toThrow`.
7. Add the two-color test block (runtime + `expectTypeOf`).
