/**
 * Prisma adapter — renders the portable filter AST to a plain Prisma `where`
 * object. No driver dependency (returns plain objects). Text ops map to Prisma's
 * case-insensitive `contains`/`startsWith`/`endsWith`; `between` → `gte`/`lte`;
 * `inArray` → `in`; scalar-list array ops → `hasEvery`/`hasSome`.
 *
 * Raw SQL `like`/`ilike`/`notIlike` (arbitrary `%`/`_` patterns) and
 * `arrayContained` have no Prisma equivalent and throw with a clear message —
 * use `contains`/`startsWith`/`endsWith` instead.
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
    case "notIlike":
      throw new Error(
        `toPrismaWhere: \`${cond.op}\` (raw SQL pattern) has no Prisma equivalent — use contains/startsWith/endsWith.`,
      );
    case "inArray":
      return { in: cond.values };
    case "notInArray":
      return { notIn: cond.values };
    case "between":
      return { gte: cond.from, lte: cond.to };
    case "notBetween":
      return { not: { gte: cond.from, lte: cond.to } };
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
