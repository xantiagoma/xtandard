/**
 * Renders the compiled filter AST to a Prisma `where` object (no driver dependency).
 *
 * Text ops map to Prisma's case-insensitive `contains`/`startsWith`/`endsWith`;
 * `between` (lowered upstream) → `gte`/`lte`; `inArray` → `in`; scalar-list array ops →
 * `hasEvery`/`hasSome`. `like`/`ilike`/`notIlike` are reduced to
 * `contains`/`startsWith`/`endsWith` when the pattern allows (`%x%`/`x%`/`%x`); only
 * genuinely arbitrary patterns (internal `%`, any `_`), which Prisma's `where` can't
 * express, throw (use `$queryRaw`). `arrayContained` (array ⊆ values) also has no Prisma
 * operator.
 *
 * Import from `@xtandard/lib/filters/prisma`.
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
 *
 * @module filters/prisma
 */

export * from "./filters/prisma.ts";
