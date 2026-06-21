/**
 * Compile-time inference assertions for the public `xantiagoma/filters` types.
 * Checked by `tsc --noEmit` (via `bun run check`); not run by the test runner.
 */
import type { Equal, Expect } from "type-testing";
import type { SQL } from "drizzle-orm";

import type { DatePreset, FieldFilter, FieldKind, NumberFilter } from "../src/filters/model.ts";
import type { DateFilterResolver, buildWhere } from "../src/filters/drizzle/build-where.ts";
import type { FieldSpec } from "../src/filters/drizzle/spec.ts";
import { dateField, numberField } from "../src/filters/drizzle/spec.ts";

// FieldFilter is a discriminated union over the six column kinds.
export type _Kinds = Expect<
  Equal<FieldKind, "text" | "number" | "enum" | "boolean" | "date" | "array">
>;

// Narrowing by `kind` selects that kind's variant.
export type _NumberIsVariant = Expect<
  Equal<Extract<FieldFilter, { kind: "number" }>, NumberFilter>
>;

// The injected date resolver maps a DatePreset → half-open instant bounds.
export type _Resolver = Expect<
  Equal<
    DateFilterResolver,
    (input: { value: DatePreset }) => { start: Date | null; end: Date | null }
  >
>;

// buildWhere returns a Drizzle SQL (or undefined).
export type _BuildWhere = Expect<Equal<ReturnType<typeof buildWhere>, { where: SQL | undefined }>>;

// The spec field builders return a FieldSpec (kind↔column type checked at the call).
export type _DateField = Expect<Equal<ReturnType<typeof dateField>, FieldSpec>>;
export type _NumberField = Expect<Equal<ReturnType<typeof numberField>, FieldSpec>>;
