/**
 * Prisma adapter — renders the portable filter AST to a plain Prisma `where`
 * object (no driver dependency). Text ops map to Prisma's case-insensitive
 * `contains`/`startsWith`/`endsWith`; `between` (lowered upstream) → `gte`/`lte`;
 * `inArray` → `in`; scalar-list array ops → `hasEvery`/`hasSome`.
 *
 * `like`/`ilike`/`notIlike` are reduced to `contains`/`startsWith`/`endsWith`
 * when the pattern allows (`%x%`/`x%`/`%x`); only genuinely arbitrary patterns
 * (internal `%`, any `_`) — which Prisma's `where` can't express — throw (use
 * `$queryRaw`). `arrayContained` (array ⊆ values) also has no Prisma operator.
 *
 * @example
 * ```ts
 * import { buildWhere, textField, numberField } from "@xtandard/lib/filters/prisma";
 *
 * const spec = { name: textField({ field: "name" }), amount: numberField({ field: "amount" }) };
 * const { where } = buildWhere({ spec, filters });
 * // where → { AND: [{ name: { contains: "ab", mode: "insensitive" } }, … ] }
 * await prisma.user.findMany({ where });
 * ```
 */

import { compileFilterNode, compileFilters, type DateFilterResolver } from "./compile.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FieldKind, FilterNode } from "./types.ts";

export type PrismaFieldSpec = { kind: FieldKind; field: string };
export type PrismaFilterSpec = Record<string, PrismaFieldSpec>;
export type PrismaWhere = Record<string, unknown>;

const make =
  (kind: FieldKind) =>
  (input: { field: string }): PrismaFieldSpec => ({ kind, field: input.field });

export const dateField = make("date");
export const textField = make("text");
export const numberField = make("number");
export const enumField = make("enum");
export const booleanField = make("boolean");
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

/** Render a portable {@link CompiledWhere} to a Prisma `where` object. */
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

/** Flat AND list → a Prisma `where` object (or undefined). */
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

/** Recursive and/or/not tree → a Prisma `where` object (or undefined). */
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
