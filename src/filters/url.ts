/**
 * Compact URL codec — shrink a filter request for the address bar **without
 * touching the readable model**. The model stays self-documenting
 * (`{ kind, operator, value }`); `encode` drops what's redundant and abbreviates,
 * `decode` reconstructs the model using the `field → kind` allow-list the client
 * already has (e.g. a resource's `_metadata`). The compact form is plain JSON,
 * ready for Rison/JSON in a query param.
 *
 * **Spec-aware:** `kind` is NOT stored in the URL — it is recovered from `kinds`
 * on decode (the field name already implies its kind). Decode is defensive
 * (unknown field / bad code / wrong-typed arg → that leaf is dropped, mirroring
 * how `compileFilters` drops non-allow-listed fields); the caller still validates
 * the reconstructed model (valibot/zod/…) as the real guard.
 *
 * Transformations:
 * - the `filter` wrapper is flattened into the column node (`{ f, o, … }`);
 * - connectives become a single key — `{ and: [...] }` / `{ or: [...] }` /
 *   `{ not: … }` — instead of `{ type, nodes }`;
 * - keys abbreviate (`field`→`f`, `operator`→`o`, `value`→`v`, `values`→`vs`,
 *   `from`→`fr`/`to`→`to`; date `unit`→`u`/`timeZone`→`tz`/`anchor`→`a`/`end`→`e`/
 *   `weekStartsOn`→`ws`);
 * - operators and date units map to short codes ({@link OPERATOR_CODE},
 *   {@link UNIT_CODE}).
 *
 * @example
 * ```ts
 * import { compactFilterNode, expandFilterNode } from "@xtandard/lib/filters";
 *
 * const kinds = { title: "text", status: "enum", priority: "number" } as const;
 * const { compact } = compactFilterNode({ node });
 * // → { or: [ { f: "title", o: "ct", v: "inves" }, … ] }
 * //   Rison: (or:!((f:title,o:ct,v:inves),(f:status,o:iA,vs:!(todo,in_progress)),(and:!((f:priority,o:eq,v:1)))))
 * const { node } = expandFilterNode({ compact, kinds }); // kind restored from `kinds`
 * ```
 */

import type {
  ArrayFilter,
  BooleanFilter,
  DateFilter,
  DatePreset,
  DateUnit,
  EnumFilter,
  FieldFilter,
  FieldKind,
  FieldKindSpec,
  FilterNode,
  FiltersRequest,
  NumberFilter,
  TextFilter,
} from "./types.ts";
import type {
  ArrayOperator,
  BooleanOperator,
  DateOperator,
  EnumOperator,
  NumberOperator,
  TextOperator,
  UnaryOperator,
} from "./operators.ts";

type AnyOperator =
  | TextOperator
  | NumberOperator
  | EnumOperator
  | BooleanOperator
  | DateOperator
  | ArrayOperator;

/** Model operator → short URL code (the inverse is {@link operatorFromCode}). */
export const OPERATOR_CODE: Record<AnyOperator, string> = {
  eq: "eq",
  ne: "ne",
  lt: "lt",
  gt: "gt",
  lte: "le",
  gte: "ge",
  contains: "ct",
  startsWith: "sw",
  endsWith: "ew",
  like: "lk",
  ilike: "il",
  notIlike: "nil",
  between: "bt",
  notBetween: "nbt",
  inArray: "iA",
  notInArray: "niA",
  arrayContains: "aC",
  arrayContained: "aD",
  arrayOverlaps: "aO",
  isNull: "nu",
  isNotNull: "nn",
  is: "is",
  before: "bf",
  after: "af",
};

/** Short URL code → model operator (inverse of {@link OPERATOR_CODE}). */
export function operatorFromCode(code: string): AnyOperator | null {
  switch (code) {
    case "eq":
      return "eq";
    case "ne":
      return "ne";
    case "lt":
      return "lt";
    case "gt":
      return "gt";
    case "le":
      return "lte";
    case "ge":
      return "gte";
    case "ct":
      return "contains";
    case "sw":
      return "startsWith";
    case "ew":
      return "endsWith";
    case "lk":
      return "like";
    case "il":
      return "ilike";
    case "nil":
      return "notIlike";
    case "bt":
      return "between";
    case "nbt":
      return "notBetween";
    case "iA":
      return "inArray";
    case "niA":
      return "notInArray";
    case "aC":
      return "arrayContains";
    case "aD":
      return "arrayContained";
    case "aO":
      return "arrayOverlaps";
    case "nu":
      return "isNull";
    case "nn":
      return "isNotNull";
    case "is":
      return "is";
    case "bf":
      return "before";
    case "af":
      return "after";
    default:
      return null;
  }
}

/** Date unit → short URL code (the inverse is {@link unitFromCode}). */
export const UNIT_CODE: Record<DateUnit, string> = {
  millisecond: "ms",
  second: "s",
  minute: "min",
  hour: "h",
  day: "d",
  week: "w",
  month: "mo",
  quarter: "q",
  halfYear: "hy",
  year: "y",
};

/** Short URL code → date unit (inverse of {@link UNIT_CODE}). */
export function unitFromCode(code: string): DateUnit | null {
  switch (code) {
    case "ms":
      return "millisecond";
    case "s":
      return "second";
    case "min":
      return "minute";
    case "h":
      return "hour";
    case "d":
      return "day";
    case "w":
      return "week";
    case "mo":
      return "month";
    case "q":
      return "quarter";
    case "hy":
      return "halfYear";
    case "y":
      return "year";
    default:
      return null;
  }
}

// ── compact wire shapes (plain JSON — what goes through Rison/JSON) ──────────

/** A flattened, kind-less column filter: `{ f, o, …args }`. */
export type CompactLeaf = {
  f: string;
  o: string;
  v?: string | number | boolean;
  vs?: (string | number)[];
  fr?: number;
  to?: number;
  u?: string;
  tz?: string;
  a?: string;
  e?: string;
  ws?: number;
};

/** A compact and/or/not tree — connectives are a single key. */
export type CompactNode =
  | CompactLeaf
  | { and: CompactNode[] }
  | { or: CompactNode[] }
  | { not: CompactNode };

// ── encode (model → compact) — total; `kind` is simply dropped ──────────────

function compactLeaf(field: string, filter: FieldFilter): CompactLeaf {
  const o = OPERATOR_CODE[filter.operator];

  if ("anchor" in filter) {
    return {
      f: field,
      o,
      u: UNIT_CODE[filter.unit],
      tz: filter.timeZone,
      a: filter.anchor,
      ...(filter.end !== undefined ? { e: filter.end } : {}),
      ...(filter.weekStartsOn !== undefined ? { ws: filter.weekStartsOn } : {}),
    };
  }
  if ("from" in filter) return { f: field, o, fr: filter.from, to: filter.to };
  if ("values" in filter) return { f: field, o, vs: filter.values };
  if ("value" in filter) return { f: field, o, v: filter.value };

  return { f: field, o };
}

function compactNode(node: FilterNode): CompactNode {
  switch (node.type) {
    case "column":
      return compactLeaf(node.field, node.filter);
    case "and":
      return { and: node.nodes.map(compactNode) };
    case "or":
      return { or: node.nodes.map(compactNode) };
    case "not":
      return { not: compactNode(node.node) };
  }
}

// ── decode (compact → model) — defensive; narrows by shape, no casts ─────────

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const isString = (x: unknown): x is string => typeof x === "string";
const isNumber = (x: unknown): x is number => typeof x === "number";
const isStringOrNumber = (x: unknown): x is string | number =>
  typeof x === "string" || typeof x === "number";

function asUnary(o: string): UnaryOperator | null {
  switch (o) {
    case "isNull":
    case "isNotNull":
      return o;
    default:
      return null;
  }
}

function asSet(o: string): "inArray" | "notInArray" | null {
  switch (o) {
    case "inArray":
    case "notInArray":
      return o;
    default:
      return null;
  }
}

function asArrayCol(o: string): "arrayContains" | "arrayContained" | "arrayOverlaps" | null {
  switch (o) {
    case "arrayContains":
    case "arrayContained":
    case "arrayOverlaps":
      return o;
    default:
      return null;
  }
}

function asTextScalar(
  o: string,
): "eq" | "ne" | "contains" | "startsWith" | "endsWith" | "like" | "ilike" | "notIlike" | null {
  switch (o) {
    case "eq":
    case "ne":
    case "contains":
    case "startsWith":
    case "endsWith":
    case "like":
    case "ilike":
    case "notIlike":
      return o;
    default:
      return null;
  }
}

function asNumberScalar(o: string): "eq" | "ne" | "lt" | "gt" | "lte" | "gte" | null {
  switch (o) {
    case "eq":
    case "ne":
    case "lt":
    case "gt":
    case "lte":
    case "gte":
      return o;
    default:
      return null;
  }
}

function asEquality(o: string): "eq" | "ne" | null {
  switch (o) {
    case "eq":
    case "ne":
      return o;
    default:
      return null;
  }
}

function asDatePreset(o: string): "is" | "before" | "after" | "between" | null {
  switch (o) {
    case "is":
    case "before":
    case "after":
    case "between":
      return o;
    default:
      return null;
  }
}

function textFilter(o: string, x: Record<string, unknown>): TextFilter | null {
  const unary = asUnary(o);
  if (unary) return { kind: "text", operator: unary };

  const set = asSet(o);
  if (set && Array.isArray(x.vs)) {
    return { kind: "text", operator: set, values: x.vs.filter(isString) };
  }

  const scalar = asTextScalar(o);
  if (scalar && isString(x.v)) return { kind: "text", operator: scalar, value: x.v };

  return null;
}

function numberFilter(o: string, x: Record<string, unknown>): NumberFilter | null {
  const unary = asUnary(o);
  if (unary) return { kind: "number", operator: unary };

  if ((o === "between" || o === "notBetween") && isNumber(x.fr) && isNumber(x.to)) {
    return { kind: "number", operator: o, from: x.fr, to: x.to };
  }

  const set = asSet(o);
  if (set && Array.isArray(x.vs)) {
    return { kind: "number", operator: set, values: x.vs.filter(isNumber) };
  }

  const scalar = asNumberScalar(o);
  if (scalar && isNumber(x.v)) return { kind: "number", operator: scalar, value: x.v };

  return null;
}

function enumFilter(o: string, x: Record<string, unknown>): EnumFilter | null {
  const unary = asUnary(o);
  if (unary) return { kind: "enum", operator: unary };

  const set = asSet(o);
  if (set && Array.isArray(x.vs)) {
    return { kind: "enum", operator: set, values: x.vs.filter(isString) };
  }

  const eq = asEquality(o);
  if (eq && isString(x.v)) return { kind: "enum", operator: eq, value: x.v };

  return null;
}

function booleanFilter(o: string, x: Record<string, unknown>): BooleanFilter | null {
  const unary = asUnary(o);
  if (unary) return { kind: "boolean", operator: unary };

  const eq = asEquality(o);
  if (eq && typeof x.v === "boolean") return { kind: "boolean", operator: eq, value: x.v };

  return null;
}

function arrayFilter(o: string, x: Record<string, unknown>): ArrayFilter | null {
  const unary = asUnary(o);
  if (unary) return { kind: "array", operator: unary };

  const arr = asArrayCol(o);
  if (arr && Array.isArray(x.vs)) {
    return { kind: "array", operator: arr, values: x.vs.filter(isStringOrNumber) };
  }

  return null;
}

function dateFilter(o: string, x: Record<string, unknown>): DateFilter | null {
  const unary = asUnary(o);
  if (unary) return { kind: "date", operator: unary };

  const preset = asDatePreset(o);
  if (!preset) return null;

  const unit = isString(x.u) ? unitFromCode(x.u) : null;
  if (!unit || !isString(x.tz) || !isString(x.a)) return null;

  const base: DatePreset = { kind: "date", operator: preset, unit, timeZone: x.tz, anchor: x.a };
  if (isString(x.e)) base.end = x.e;
  if (isNumber(x.ws)) base.weekStartsOn = x.ws;

  return base;
}

function expandLeaf(x: Record<string, unknown>, kind: FieldKind, o: string): FieldFilter | null {
  switch (kind) {
    case "text":
      return textFilter(o, x);
    case "number":
      return numberFilter(o, x);
    case "enum":
      return enumFilter(o, x);
    case "boolean":
      return booleanFilter(o, x);
    case "date":
      return dateFilter(o, x);
    case "array":
      return arrayFilter(o, x);
  }
}

function expandNode(x: unknown, kinds: FieldKindSpec): FilterNode | null {
  if (!isRecord(x)) return null;

  if (Array.isArray(x.and)) {
    const nodes = x.and.map((c) => expandNode(c, kinds)).filter((n): n is FilterNode => n !== null);

    return nodes.length > 0 ? { type: "and", nodes } : null;
  }
  if (Array.isArray(x.or)) {
    const nodes = x.or.map((c) => expandNode(c, kinds)).filter((n): n is FilterNode => n !== null);

    return nodes.length > 0 ? { type: "or", nodes } : null;
  }
  if ("not" in x) {
    const inner = expandNode(x.not, kinds);

    return inner ? { type: "not", node: inner } : null;
  }
  if (isString(x.f) && isString(x.o)) {
    const kind = kinds[x.f];
    if (!kind) return null;

    const operator = operatorFromCode(x.o);
    if (!operator) return null;

    const filter = expandLeaf(x, kind, operator);

    return filter ? { type: "column", field: x.f, filter } : null;
  }

  return null;
}

// ── public surface ──────────────────────────────────────────────────────────

/** Encode a recursive and/or/not tree to its compact (Rison-ready) form. */
export function compactFilterNode(input: { node: FilterNode }): { compact: CompactNode } {
  return { compact: compactNode(input.node) };
}

/** Decode a compact tree back to a `FilterNode`, restoring `kind` from `kinds`
 * (a field → kind allow-list, e.g. from `_metadata`). Returns `null` if nothing
 * allow-listed survives. */
export function expandFilterNode(input: { compact: unknown; kinds: FieldKindSpec }): {
  node: FilterNode | null;
} {
  return { node: expandNode(input.compact, input.kinds) };
}

/** Encode a flat AND list of column filters to compact leaves. */
export function compactFilters(input: { filters: FiltersRequest }): { compact: CompactLeaf[] } {
  return { compact: input.filters.map((c) => compactLeaf(c.field, c.filter)) };
}

/** Decode compact leaves back to a flat `FiltersRequest` (non-allow-listed /
 * malformed leaves are dropped), restoring `kind` from `kinds`. */
export function expandFilters(input: { compact: unknown; kinds: FieldKindSpec }): {
  filters: FiltersRequest;
} {
  if (!Array.isArray(input.compact)) return { filters: [] };

  const filters: FiltersRequest = [];
  for (const item of input.compact) {
    if (!isRecord(item) || !isString(item.f) || !isString(item.o)) continue;

    const kind = input.kinds[item.f];
    if (!kind) continue;

    const operator = operatorFromCode(item.o);
    if (!operator) continue;

    const filter = expandLeaf(item, kind, operator);
    if (filter) filters.push({ field: item.f, filter });
  }

  return { filters };
}

/** Bind a `field → kind` allow-list once and get encode/decode pairs — sugar for
 * composing with a URL-state codec (e.g. `parseAsCodec(risonCodec(...))`). */
export function createFilterUrlCodec(input: { kinds: FieldKindSpec }): {
  encodeNode: (node: FilterNode) => CompactNode;
  decodeNode: (compact: unknown) => FilterNode | null;
  encodeFilters: (filters: FiltersRequest) => CompactLeaf[];
  decodeFilters: (compact: unknown) => FiltersRequest;
} {
  return {
    encodeNode: (node) => compactNode(node),
    decodeNode: (compact) => expandNode(compact, input.kinds),
    encodeFilters: (filters) => filters.map((c) => compactLeaf(c.field, c.filter)),
    decodeFilters: (compact) => expandFilters({ compact, kinds: input.kinds }).filters,
  };
}
