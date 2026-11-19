import { compileFilterNode, compileFilters, type DateFilterResolver } from "./compile.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FieldKind, FilterNode } from "./types.ts";

/** One allow-listed field: its filter kind plus the Prisma model field name it reads. */
export type PrismaFieldSpec = { kind: FieldKind; field: string };
/** A resource's filter allow-list: public field name → {@link PrismaFieldSpec}. */
export type PrismaFilterSpec = Record<string, PrismaFieldSpec>;
/** A plain Prisma `where` object, ready for `prisma.<model>.findMany({ where })`. */
export type PrismaWhere = Record<string, unknown>;

const make =
  (kind: FieldKind) =>
  (input: { field: string }): PrismaFieldSpec => ({ kind, field: input.field });

/**
 * Allow-list a public field as a `date` filter over a Prisma `DateTime` model field, named by
 * its model field name (`"createdAt"`). A `date` preset needs the `resolveDate` you pass to
 * `buildWhere`, and becomes a half-open `gte`/`lt` window.
 *
 * @example
 * ```ts
 * import { buildWhere, dateField } from "@xtandard/lib/filters/prisma";
 *
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") });
 * const { where } = buildWhere({
 *   spec: { createdAt: dateField({ field: "createdAt" }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * });
 * // where → { AND: [
 * //   { createdAt: { gte: new Date("2026-01-01T00:00:00Z") } },
 * //   { createdAt: { lt: new Date("2026-02-01T00:00:00Z") } },
 * // ] }
 * ```
 */
export const dateField = make("date");
/**
 * Allow-list a public field as a `text` filter over a Prisma `String` model field, named by its
 * model field name (`"name"`). `contains`/`startsWith`/`endsWith` map to Prisma's operators with
 * `mode: "insensitive"`; `like`/`ilike` patterns that Prisma can't express throw.
 *
 * @example
 * ```ts
 * import { buildWhere, textField } from "@xtandard/lib/filters/prisma";
 *
 * const { where } = buildWhere({
 *   spec: { name: textField({ field: "name" }) },
 *   filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "ann" } }],
 * });
 * // where → { name: { contains: "ann", mode: "insensitive" } }
 * ```
 */
export const textField = make("text");
/**
 * Allow-list a public field as a `number` filter over a Prisma `Int`/`Float` model field, named
 * by its model field name (`"total"`). `between` becomes `gte` + `lte`.
 *
 * @example
 * ```ts
 * import { buildWhere, numberField } from "@xtandard/lib/filters/prisma";
 *
 * const { where } = buildWhere({
 *   spec: { total: numberField({ field: "total" }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } }],
 * });
 * // where → { AND: [{ total: { gte: 10 } }, { total: { lte: 20 } }] }
 * ```
 */
export const numberField = make("number");
/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null checks)
 * over a Prisma enum or `String` model field, named by its model field name (`"status"`).
 *
 * @example
 * ```ts
 * import { buildWhere, enumField } from "@xtandard/lib/filters/prisma";
 *
 * const { where } = buildWhere({
 *   spec: { status: enumField({ field: "status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "done"] } }],
 * });
 * // where → { status: { in: ["open", "done"] } }
 * ```
 */
export const enumField = make("enum");
/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a Prisma
 * `Boolean` model field, named by its model field name (`"done"`).
 *
 * @example
 * ```ts
 * import { booleanField, buildWhere } from "@xtandard/lib/filters/prisma";
 *
 * const { where } = buildWhere({
 *   spec: { done: booleanField({ field: "done" }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "eq", value: false } }],
 * });
 * // where → { done: { equals: false } }
 * ```
 */
export const booleanField = make("boolean");
/**
 * Allow-list a public field as an `array` filter over a Prisma scalar-list model field (e.g.
 * `tags String[]`), named by its model field name (`"tags"`). `arrayContains` → `hasEvery`,
 * `arrayOverlaps` → `hasSome`; `arrayContained` has no Prisma operator and throws.
 *
 * @example
 * ```ts
 * import { arrayField, buildWhere } from "@xtandard/lib/filters/prisma";
 *
 * const { where } = buildWhere({
 *   spec: { tags: arrayField({ field: "tags" }) },
 *   filters: [{ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] } }],
 * });
 * // where → { tags: { hasSome: ["ts", "js"] } }
 * ```
 */
export const arrayField = make("array");

// Reduce a SQL LIKE pattern to a Prisma string filter, if possible. Returns
// `null` for patterns Prisma's `where` can't express (internal `%`, any `_`).
function likeToPrisma(
  pattern: string,
):
  | { contains: string }
  | { startsWith: string }
  | { endsWith: string }
  | { equals: string }
  | null {
  const tokens: ({ lit: string } | { wild: "%" | "_" })[] = [];
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) {
      tokens.push({ lit: pattern[i + 1] ?? "" });
      i += 1;
    } else if (c === "%" || c === "_") {
      tokens.push({ wild: c });
    } else {
      tokens.push({ lit: c ?? "" });
    }
  }

  if (tokens.some((t) => "wild" in t && t.wild === "_")) return null; // single-char wildcard

  let start = 0;
  let end = tokens.length;
  const lead = tokens[start] && "wild" in tokens[start]!;
  if (lead) start += 1;
  const trail = end > start && tokens[end - 1] && "wild" in tokens[end - 1]!;
  if (trail) end -= 1;

  const mid = tokens.slice(start, end);
  if (mid.some((t) => "wild" in t)) return null; // internal `%`

  const value = mid.map((t) => ("lit" in t ? t.lit : "")).join("");

  if (lead && trail) return { contains: value };
  if (lead) return { endsWith: value };
  if (trail) return { startsWith: value };

  return { equals: value };
}

function condWhere(cond: CompiledCond): unknown {
  switch (cond.op) {
    case "eq":
      return { equals: cond.value };
    case "ne":
      return { not: cond.value };
    case "lt":
      return { lt: cond.value };
    case "gt":
      return { gt: cond.value };
    case "lte":
      return { lte: cond.value };
    case "gte":
      return { gte: cond.value };
    case "contains":
      return { contains: cond.value, mode: "insensitive" };
    case "startsWith":
      return { startsWith: cond.value, mode: "insensitive" };
    case "endsWith":
      return { endsWith: cond.value, mode: "insensitive" };
    case "like":
    case "ilike":
    case "notIlike": {
      // Prisma's `where` has no raw LIKE, but most patterns reduce to
      // contains/startsWith/endsWith (`%x%`/`x%`/`%x`). Only genuinely arbitrary
      // patterns (internal `%` or any `_`) are irreducible → throw.
      const reduced = likeToPrisma(cond.value);
      if (!reduced) {
        throw new Error(
          `toPrismaWhere: \`${cond.op}\` pattern "${cond.value}" has internal "%"/"_" wildcards — Prisma's where has no raw LIKE; use $queryRaw or contains/startsWith/endsWith.`,
        );
      }

      const insensitive = cond.op === "ilike" || cond.op === "notIlike";
      const filter = insensitive ? { ...reduced, mode: "insensitive" } : reduced;

      return cond.op === "notIlike" ? { not: filter } : filter;
    }
    case "inArray":
      return { in: cond.values };
    case "notInArray":
      return { notIn: cond.values };
    case "arrayContains":
      return { hasEvery: cond.values };
    case "arrayOverlaps":
      return { hasSome: cond.values };
    case "arrayContained":
      throw new Error(
        "toPrismaWhere: `arrayContained` (array ⊆ values) has no native Prisma operator.",
      );
    case "isNull":
      return { equals: null };
    case "isNotNull":
      return { not: null };
  }
}

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to a Prisma `where` object, looking each field
 * up in `fields`. Conditions on fields missing from `fields` are dropped; `null` (or an AST
 * that drops to nothing) gives `undefined`. `and`/`or`/`not` become `AND`/`OR`/`NOT`. Throws
 * for `arrayContained` and for `like`/`ilike` patterns with an inner `%` or any `_`. Most code
 * calls `buildWhere`, which compiles and renders in one step.
 *
 * @example
 * ```ts
 * import { toPrismaWhere } from "@xtandard/lib/filters/prisma";
 *
 * toPrismaWhere({
 *   where: { type: "and", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "cond", cond: { field: "name", op: "isNotNull" } },
 *   ] },
 *   fields: { amount: "amount", name: "name" },
 * });
 * // → { AND: [{ amount: { gt: 5 } }, { name: { not: null } }] }
 * ```
 */
export function toPrismaWhere(input: {
  where: CompiledWhere | null;
  fields: Record<string, string>;
}): PrismaWhere | undefined {
  const render = (node: CompiledWhere): PrismaWhere | undefined => {
    switch (node.type) {
      case "cond": {
        const name = input.fields[node.cond.field];

        return name === undefined ? undefined : { [name]: condWhere(node.cond) };
      }
      case "and":
      case "or": {
        const parts = node.nodes.map(render).filter((p): p is PrismaWhere => p !== undefined);
        if (parts.length === 0) return undefined;

        return { [node.type === "and" ? "AND" : "OR"]: parts };
      }
      case "not": {
        const inner = render(node.node);

        return inner === undefined ? undefined : { NOT: inner };
      }
    }
  };

  return input.where ? render(input.where) : undefined;
}

const fieldsOf = (spec: PrismaFilterSpec): Record<string, string> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.field]));
const kindsOf = (spec: PrismaFilterSpec): Record<string, FieldKind> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.kind]));

/**
 * Compile a flat, AND-combined list of column filters into a Prisma `where` object. Only fields
 * in `spec` whose kind matches the filter's `kind` are kept; the rest are silently dropped.
 * `where` is `undefined` when nothing survives, which Prisma treats as "no filter". A `date`
 * preset filter needs `resolveDate` (it throws without one).
 *
 * @example
 * ```ts
 * import { buildWhere, numberField, textField } from "@xtandard/lib/filters/prisma";
 *
 * const spec = { name: textField({ field: "name" }), amount: numberField({ field: "amount" }) };
 * const { where } = buildWhere({ spec, filters: [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ] });
 * // where → { AND: [{ name: { startsWith: "Re", mode: "insensitive" } }, { amount: { gte: 100 } }] }
 * // in an app: await prisma.task.findMany({ where });
 * ```
 */
export function buildWhere(input: {
  spec: PrismaFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): { where: PrismaWhere | undefined } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return { where: toPrismaWhere({ where, fields: fieldsOf(input.spec) }) };
}

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into a Prisma `where` object (or
 * `undefined`). Same allow-list rules as `buildWhere`.
 *
 * @example
 * ```ts
 * import { buildFilterNode, numberField, textField } from "@xtandard/lib/filters/prisma";
 *
 * const spec = { name: textField({ field: "name" }), amount: numberField({ field: "amount" }) };
 * const { where } = buildFilterNode({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * // where → { OR: [{ name: { equals: "Rent" } }, { NOT: { amount: { lt: 0 } } }] }
 * ```
 */
export function buildFilterNode(input: {
  spec: PrismaFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): { where: PrismaWhere | undefined } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return { where: toPrismaWhere({ where, fields: fieldsOf(input.spec) }) };
}
