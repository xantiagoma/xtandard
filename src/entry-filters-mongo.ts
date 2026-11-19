/**
 * Renders the compiled filter AST to a Mongo filter object (no driver dependency).
 * Works with the MongoDB driver and Mongoose alike, since it returns plain objects.
 *
 * Text matching becomes `$regex`; `between` → `$gte`/`$lte`; `inArray` → `$in`.
 * `like`/`ilike` translate the SQL `LIKE` pattern to a regex (`%`→`.*`, `_`→`.`).
 * The PG array ops map natively: `arrayContains` (`@>`) → `$all`, `arrayOverlaps`
 * (`&&`) → `$in`, and `arrayContained` (`<@`, field ⊆ values) → an `$expr` with
 * `$setIsSubset` (Mongo has no single-symbol "contained by" operator).
 *
 * Import from `@xtandard/lib/filters/mongo`.
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
 *
 * @module filters/mongo
 */

export * from "./filters/mongo.ts";
