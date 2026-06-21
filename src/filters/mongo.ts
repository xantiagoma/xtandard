/**
 * MongoDB / Mongoose adapter — renders the portable filter AST to a plain Mongo
 * query filter object. No driver dependency (returns plain objects). Text
 * matching becomes `$regex`; `between` → `$gte`/`$lte`; `inArray` → `$in`.
 *
 * Some PostgreSQL-flavored ops have no faithful Mongo equivalent and throw with
 * a clear message: `arrayContained` (use a different model), and SQL `like`/
 * `notIlike` are mapped to case-sensitive / negated regex respectively.
 */

import { compileFilterNode, compileFilters, type DateFilterResolver } from "./compile.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FieldKind, FilterNode } from "./types.ts";

export type MongoFieldSpec = { kind: FieldKind; path: string };
export type MongoFilterSpec = Record<string, MongoFieldSpec>;
export type MongoFilter = Record<string, unknown>;

const field =
  (kind: FieldKind) =>
  (input: { path: string }): MongoFieldSpec => ({ kind, path: input.path });

export const dateField = field("date");
export const textField = field("text");
export const numberField = field("number");
export const enumField = field("enum");
export const booleanField = field("boolean");
export const arrayField = field("array");

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// SQL LIKE pattern → regex source: `%` → `.*`, `_` → `.`, `\x` → literal x.
function likeToRegex(pattern: string): string {
  let out = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) {
      out += escapeRegex(pattern[i + 1] ?? "");
      i += 1;
    } else if (c === "%") {
      out += ".*";
    } else if (c === "_") {
      out += ".";
    } else {
      out += escapeRegex(c ?? "");
    }
  }

  return `${out}$`;
}

function condFilter(cond: CompiledCond): unknown {
  switch (cond.op) {
    case "eq":
      return { $eq: cond.value };
    case "ne":
      return { $ne: cond.value };
    case "lt":
      return { $lt: cond.value };
    case "gt":
      return { $gt: cond.value };
    case "lte":
      return { $lte: cond.value };
    case "gte":
      return { $gte: cond.value };
    case "contains":
      return { $regex: escapeRegex(cond.value), $options: "i" };
    case "startsWith":
      return { $regex: `^${escapeRegex(cond.value)}`, $options: "i" };
    case "endsWith":
      return { $regex: `${escapeRegex(cond.value)}$`, $options: "i" };
    case "like":
      return { $regex: likeToRegex(cond.value) };
    case "ilike":
      return { $regex: likeToRegex(cond.value), $options: "i" };
    case "notIlike":
      return { $not: { $regex: likeToRegex(cond.value), $options: "i" } };
    case "inArray":
      return { $in: cond.values };
    case "notInArray":
      return { $nin: cond.values };
    case "between":
      return { $gte: cond.from, $lte: cond.to };
    case "notBetween":
      return { $not: { $gte: cond.from, $lte: cond.to } };
    case "arrayContains":
      return { $all: cond.values };
    case "arrayOverlaps":
      return { $in: cond.values };
    case "arrayContained":
      throw new Error(
        "toMongoFilter: `arrayContained` (array ⊆ values) has no native Mongo operator.",
      );
    case "isNull":
      return { $eq: null };
    case "isNotNull":
      return { $ne: null };
  }
}

/** Render a portable {@link CompiledWhere} to a Mongo filter object. */
export function toMongoFilter(input: {
  where: CompiledWhere | null;
  paths: Record<string, string>;
}): MongoFilter | undefined {
  const render = (node: CompiledWhere): MongoFilter | undefined => {
    switch (node.type) {
      case "cond": {
        const path = input.paths[node.cond.field];

        return path === undefined ? undefined : { [path]: condFilter(node.cond) };
      }
      case "and":
      case "or": {
        const parts = node.nodes.map(render).filter((p): p is MongoFilter => p !== undefined);
        if (parts.length === 0) return undefined;

        return { [node.type === "and" ? "$and" : "$or"]: parts };
      }
      case "not": {
        const inner = render(node.node);

        return inner === undefined ? undefined : { $nor: [inner] };
      }
    }
  };

  return input.where ? render(input.where) : undefined;
}

const pathsOf = (spec: MongoFilterSpec): Record<string, string> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.path]));
const kindsOf = (spec: MongoFilterSpec): Record<string, FieldKind> =>
  Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, s.kind]));

/** Flat AND list → a Mongo filter object (or undefined). */
export function buildFilter(input: {
  spec: MongoFilterSpec;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}): { filter: MongoFilter | undefined } {
  const { where } = compileFilters({
    spec: kindsOf(input.spec),
    filters: input.filters,
    resolveDate: input.resolveDate,
  });

  return { filter: toMongoFilter({ where, paths: pathsOf(input.spec) }) };
}

/** Recursive and/or/not tree → a Mongo filter object (or undefined). */
export function buildFilterNode(input: {
  spec: MongoFilterSpec;
  node: FilterNode;
  resolveDate?: DateFilterResolver;
}): { filter: MongoFilter | undefined } {
  const { where } = compileFilterNode({
    spec: kindsOf(input.spec),
    node: input.node,
    resolveDate: input.resolveDate,
  });

  return { filter: toMongoFilter({ where, paths: pathsOf(input.spec) }) };
}
