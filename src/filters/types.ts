/**
 * The filter model as plain TypeScript types — the source of truth, **no
 * validation library**. Validate an untrusted request with whatever you use
 * (valibot/zod/arktype/effect/…); ready-made valibot schemas that produce these
 * exact shapes live at `xantiagoma/filters/valibot` (a `*.test-d.ts` asserts
 * they match). `compileFilters` + every adapter consume these plain objects, so
 * the core and the driver adapters never depend on a validation library.
 */

import type {
  ArrayOperator,
  BooleanOperator,
  DateOperator,
  EnumOperator,
  NumberOperator,
  TextOperator,
} from "./operators.ts";

export type FieldKind = "text" | "number" | "enum" | "boolean" | "date" | "array";

// A column data kind a public field maps to (the allow-list unit the core uses).
export type FieldKindSpec = Record<string, FieldKind>;

export type DateUnit =
  | "millisecond"
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "halfYear"
  | "year";

// ── per-kind filter variants (discriminated on `operator` within each kind) ──

export type TextFilter =
  | {
      kind: "text";
      operator: Exclude<TextOperator, "inArray" | "notInArray" | "isNull" | "isNotNull">;
      value: string;
    }
  | { kind: "text"; operator: "inArray" | "notInArray"; values: string[] }
  | { kind: "text"; operator: "isNull" | "isNotNull" };

export type NumberFilter =
  | { kind: "number"; operator: "eq" | "ne" | "lt" | "gt" | "lte" | "gte"; value: number }
  | { kind: "number"; operator: "between" | "notBetween"; from: number; to: number }
  | { kind: "number"; operator: "inArray" | "notInArray"; values: number[] }
  | { kind: "number"; operator: "isNull" | "isNotNull" };

export type EnumFilter =
  | { kind: "enum"; operator: "eq" | "ne"; value: string }
  | { kind: "enum"; operator: "inArray" | "notInArray"; values: string[] }
  | { kind: "enum"; operator: "isNull" | "isNotNull" };

export type BooleanFilter =
  | { kind: "boolean"; operator: "eq" | "ne"; value: boolean }
  | { kind: "boolean"; operator: "isNull" | "isNotNull" };

/** The DST-aware period preset (resolved to a half-open instant window by an
 * injected resolver — see the adapters' `resolveDate`). `anchor`/`end` are
 * canonical `Temporal.PlainDateTime` strings; `timeZone` an IANA id. */
export type DatePreset = {
  kind: "date";
  operator: "is" | "before" | "after" | "between";
  unit: DateUnit;
  timeZone: string;
  anchor: string;
  end?: string;
  weekStartsOn?: number;
};

export type DateFilter = DatePreset | { kind: "date"; operator: "isNull" | "isNotNull" };

export type ArrayFilter =
  | {
      kind: "array";
      operator: "arrayContains" | "arrayContained" | "arrayOverlaps";
      values: (string | number)[];
    }
  | { kind: "array"; operator: "isNull" | "isNotNull" };

export type FieldFilter =
  | TextFilter
  | NumberFilter
  | EnumFilter
  | BooleanFilter
  | DateFilter
  | ArrayFilter;

export type ColumnFilter = { field: string; filter: FieldFilter };

/** Flat AND-combined list of column filters (the common case). */
export type FiltersRequest = ColumnFilter[];

/** Recursive and/or/not tree of column filters. */
export type FilterNode =
  | { type: "column"; field: string; filter: FieldFilter }
  | { type: "and"; nodes: FilterNode[] }
  | { type: "or"; nodes: FilterNode[] }
  | { type: "not"; node: FilterNode };

// ── sort ──
export type SortDirection = "asc" | "desc";
export type SortItem = { field: string; dir: SortDirection };
export type Sort = SortItem[];

// these are referenced only to keep the per-kind operator unions honest:
export type {
  ArrayOperator,
  BooleanOperator,
  DateOperator,
  EnumOperator,
  NumberOperator,
  TextOperator,
};

// ── the portable compiled WHERE (what every adapter renders) ──

export type ScalarValue = string | number | boolean | Date;

/**
 * A normalized leaf condition — driver-agnostic. `compileFilters` lowers the
 * model into these: date presets become `gte`/`lt` (resolved `Date`s), text
 * `contains`/`startsWith`/`endsWith` become `ilike` with an escaped pattern.
 */
/** Text-matching ops kept SEMANTIC (not lowered) so each adapter renders them
 * natively: SQL → ilike/escape, Mongo → `$regex`, Prisma → contains/mode. */
export type TextMatchOp = "contains" | "startsWith" | "endsWith" | "like" | "ilike" | "notIlike";

export type CompiledCond =
  | { field: string; op: "eq" | "ne" | "lt" | "gt" | "lte" | "gte"; value: ScalarValue }
  | { field: string; op: TextMatchOp; value: string }
  | { field: string; op: "inArray" | "notInArray"; values: ScalarValue[] }
  | { field: string; op: "between" | "notBetween"; from: ScalarValue; to: ScalarValue }
  | {
      field: string;
      op: "arrayContains" | "arrayContained" | "arrayOverlaps";
      values: (string | number)[];
    }
  | { field: string; op: "isNull" | "isNotNull" };

export type CompiledOp = CompiledCond["op"];

/** The portable WHERE AST: an and/or/not tree of normalized conditions. */
export type CompiledWhere =
  | { type: "cond"; cond: CompiledCond }
  | { type: "and"; nodes: CompiledWhere[] }
  | { type: "or"; nodes: CompiledWhere[] }
  | { type: "not"; node: CompiledWhere };
