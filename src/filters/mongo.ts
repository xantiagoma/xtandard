/**
 * MongoDB / Mongoose adapter — renders the portable filter AST to a plain Mongo
 * query filter object. No driver dependency (returns plain objects). Text
 * matching becomes `$regex`; `between` → `$gte`/`$lte`; `inArray` → `$in`.
 *
 * `like`/`ilike` translate the SQL `LIKE` pattern to a regex (`%`→`.*`, `_`→`.`).
 * The PG array ops map natively: `arrayContains` (`@>`) → `$all`, `arrayOverlaps`
 * (`&&`) → `$in`, and `arrayContained` (`<@`, field ⊆ values) → an `$expr` with
 * `$setIsSubset` (Mongo has no single-symbol "contained by" operator).
 *
 * @example
 * ```ts
 * import { buildFilter, textField, numberField } from "@xtandard/lib/filters/mongo";
 *
 * const spec = { name: textField({ path: "name" }), amount: numberField({ path: "amount" }) };
 * const { filter } = buildFilter({ spec, filters, resolveDate });
 * // filter → { $and: [{ name: { $regex: "ab", $options: "i" } }, … ] }
 * const docs = await collection.find(filter ?? {}).toArray();
 * ```
 */

import { compileFilterNode, compileFilters, type DateFilterResolver } from "./compile.ts";
import type { ColumnFilter, CompiledCond, CompiledWhere, FieldKind, FilterNode } from "./types.ts";

/** One allow-listed field: its filter kind plus the document field path (`"name"`,
 * `"address.city"`) it reads. */
export type MongoFieldSpec = { kind: FieldKind; path: string };
/** A resource's filter allow-list: public field name → {@link MongoFieldSpec}. */
export type MongoFilterSpec = Record<string, MongoFieldSpec>;
/** A plain Mongo query filter object, ready for `collection.find(filter)` or Mongoose. */
export type MongoFilter = Record<string, unknown>;

const field =
  (kind: FieldKind) =>
  (input: { path: string }): MongoFieldSpec => ({ kind, path: input.path });

/**
 * Allow-list a public field as a `date` filter over a document field path (`"createdAt"`,
 * dot paths allowed) holding a `Date`. A `date` preset needs the `resolveDate` you pass to
 * `buildFilter`, and becomes a half-open `$gte`/`$lt` window.
 *
 * @example
 * ```ts
 * import { buildFilter, dateField } from "@xtandard/lib/filters/mongo";
 *
 * // Your resolver turns the preset into instant bounds (this one is hard-coded).
 * const resolveDate = () => ({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-02-01T00:00:00Z") });
 * const { filter } = buildFilter({
 *   spec: { createdAt: dateField({ path: "createdAt" }) },
 *   filters: [{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month", timeZone: "UTC", anchor: "2026-01-15T00:00:00" } }],
 *   resolveDate,
 * });
 * // filter → { $and: [
 * //   { createdAt: { $gte: new Date("2026-01-01T00:00:00Z") } },
 * //   { createdAt: { $lt: new Date("2026-02-01T00:00:00Z") } },
 * // ] }
 * ```
 */
export const dateField = field("date");
/**
 * Allow-list a public field as a `text` filter over a document field path (`"name"`,
 * `"address.city"`). `contains`/`startsWith`/`endsWith` become a case-insensitive `$regex`
 * (input escaped); `like`/`ilike` patterns are translated to a regex.
 *
 * @example
 * ```ts
 * import { buildFilter, textField } from "@xtandard/lib/filters/mongo";
 *
 * const { filter } = buildFilter({
 *   spec: { name: textField({ path: "name" }) },
 *   filters: [{ field: "name", filter: { kind: "text", operator: "contains", value: "ann" } }],
 * });
 * // filter → { name: { $regex: "ann", $options: "i" } }
 * ```
 */
export const textField = field("text");
/**
 * Allow-list a public field as a `number` filter over a document field path (`"total"`,
 * `"stats.views"`). `between` becomes `$gte` + `$lte`.
 *
 * @example
 * ```ts
 * import { buildFilter, numberField } from "@xtandard/lib/filters/mongo";
 *
 * const { filter } = buildFilter({
 *   spec: { total: numberField({ path: "total" }) },
 *   filters: [{ field: "total", filter: { kind: "number", operator: "between", from: 10, to: 20 } }],
 * });
 * // filter → { $and: [{ total: { $gte: 10 } }, { total: { $lte: 20 } }] }
 * ```
 */
export const numberField = field("number");
/**
 * Allow-list a public field as an `enum` filter (`eq`/`ne`/`inArray`/`notInArray`/null checks)
 * over a document field path (`"status"`).
 *
 * @example
 * ```ts
 * import { buildFilter, enumField } from "@xtandard/lib/filters/mongo";
 *
 * const { filter } = buildFilter({
 *   spec: { status: enumField({ path: "status" }) },
 *   filters: [{ field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "done"] } }],
 * });
 * // filter → { status: { $in: ["open", "done"] } }
 * ```
 */
export const enumField = field("enum");
/**
 * Allow-list a public field as a `boolean` filter (`eq`/`ne`/null checks) over a document
 * field path (`"done"`).
 *
 * @example
 * ```ts
 * import { booleanField, buildFilter } from "@xtandard/lib/filters/mongo";
 *
 * const { filter } = buildFilter({
 *   spec: { done: booleanField({ path: "done" }) },
 *   filters: [{ field: "done", filter: { kind: "boolean", operator: "eq", value: false } }],
 * });
 * // filter → { done: { $eq: false } }
 * ```
 */
export const booleanField = field("boolean");
/**
 * Allow-list a public field as an `array` filter over a document field path holding an array
 * (`"tags"`). `arrayContains` → `$all`, `arrayOverlaps` → `$in`, and `arrayContained` → a
 * top-level `$expr` with `$setIsSubset`.
 *
 * @example
 * ```ts
 * import { arrayField, buildFilter } from "@xtandard/lib/filters/mongo";
 *
 * const spec = { tags: arrayField({ path: "tags" }) };
 * buildFilter({ spec, filters: [{ field: "tags", filter: { kind: "array", operator: "arrayOverlaps", values: ["ts", "js"] } }] }).filter;
 * // → { tags: { $in: ["ts", "js"] } }
 * buildFilter({ spec, filters: [{ field: "tags", filter: { kind: "array", operator: "arrayContained", values: ["ts", "js"] } }] }).filter;
 * // → { $expr: { $setIsSubset: ["$tags", ["ts", "js"]] } }
 * ```
 */
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

// A field-scoped operator doc (everything except arrayContained, which needs a
// top-level `$expr` — see `condDoc`).
function fieldOp(cond: CompiledCond): unknown {
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
    case "arrayContains":
      return { $all: cond.values }; // field contains all values (PG `@>`)
    case "arrayOverlaps":
      return { $in: cond.values }; // field shares any value (PG `&&`)
    case "arrayContained":
      return undefined; // handled at the document level in `condDoc`
    case "isNull":
      return { $eq: null };
    case "isNotNull":
      return { $ne: null };
  }
}

/** A full Mongo clause for one condition against `path`. */
function condDoc(path: string, cond: CompiledCond): MongoFilter {
  // PG `<@` (field ⊆ values): no field-scoped operator, use $expr + $setIsSubset.
  if (cond.op === "arrayContained") {
    return { $expr: { $setIsSubset: [`$${path}`, cond.values] } };
  }

  return { [path]: fieldOp(cond) };
}

/**
 * Render an already-compiled {@link CompiledWhere} AST (from `compileFilters` /
 * `compileFilterNode` in `@xtandard/lib/filters`) to a Mongo filter object, looking each field
 * up in `paths`. Conditions on fields missing from `paths` are dropped; `null` (or an AST that
 * drops to nothing) gives `undefined`. `and`/`or`/`not` become `$and`/`$or`/`$nor`. Most code
 * calls `buildFilter`, which compiles and renders in one step.
 *
 * @example
 * ```ts
 * import { toMongoFilter } from "@xtandard/lib/filters/mongo";
 *
 * toMongoFilter({
 *   where: { type: "and", nodes: [
 *     { type: "cond", cond: { field: "amount", op: "gt", value: 5 } },
 *     { type: "cond", cond: { field: "name", op: "isNotNull" } },
 *   ] },
 *   paths: { amount: "amount", name: "name" },
 * });
 * // → { $and: [{ amount: { $gt: 5 } }, { name: { $ne: null } }] }
 * ```
 */
export function toMongoFilter(input: {
  where: CompiledWhere | null;
  paths: Record<string, string>;
}): MongoFilter | undefined {
  const render = (node: CompiledWhere): MongoFilter | undefined => {
    switch (node.type) {
      case "cond": {
        const path = input.paths[node.cond.field];

        return path === undefined ? undefined : condDoc(path, node.cond);
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

/**
 * Compile a flat, AND-combined list of column filters into a Mongo filter object. Only fields
 * in `spec` whose kind matches the filter's `kind` are kept; the rest are silently dropped.
 * `filter` is `undefined` when nothing survives, so pass `filter ?? {}` to `find`. A `date`
 * preset filter needs `resolveDate` (it throws without one).
 *
 * @example
 * ```ts
 * import { buildFilter, numberField, textField } from "@xtandard/lib/filters/mongo";
 *
 * const spec = { name: textField({ path: "name" }), city: textField({ path: "address.city" }), amount: numberField({ path: "amount" }) };
 * const { filter } = buildFilter({ spec, filters: [
 *   { field: "name", filter: { kind: "text", operator: "startsWith", value: "Re" } },
 *   { field: "city", filter: { kind: "text", operator: "eq", value: "Lima" } },
 *   { field: "amount", filter: { kind: "number", operator: "gte", value: 100 } },
 * ] });
 * // filter → { $and: [{ name: { $regex: "^Re", $options: "i" } }, { "address.city": { $eq: "Lima" } }, { amount: { $gte: 100 } }] }
 * // in an app: const docs = await collection.find(filter ?? {}).toArray();
 * ```
 */
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

/**
 * Compile a recursive `and`/`or`/`not` {@link FilterNode} tree into a Mongo filter object (or
 * `undefined`). Same allow-list rules as `buildFilter`; `not` becomes `$nor: [inner]`.
 *
 * @example
 * ```ts
 * import { buildFilterNode, numberField, textField } from "@xtandard/lib/filters/mongo";
 *
 * const spec = { name: textField({ path: "name" }), amount: numberField({ path: "amount" }) };
 * const { filter } = buildFilterNode({ spec, node: { type: "or", nodes: [
 *   { type: "column", field: "name", filter: { kind: "text", operator: "eq", value: "Rent" } },
 *   { type: "not", node: { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } } },
 * ] } });
 * // filter → { $or: [{ name: { $eq: "Rent" } }, { $nor: [{ amount: { $lt: 0 } }] }] }
 * ```
 */
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
