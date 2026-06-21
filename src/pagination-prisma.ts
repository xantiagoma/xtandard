import type { KeysetCompareOp, KeysetSortKey, KeysetWhere } from "./keyset.ts";

export type PrismaKeysetSortOrder = "asc" | "desc";

export type PrismaKeysetFields = Record<string, string>;

export type PrismaKeysetFilter = {
  equals?: unknown;
  gt?: unknown;
  lt?: unknown;
};

export type PrismaKeysetWhere = {
  AND?: PrismaKeysetWhere[];
  OR?: PrismaKeysetWhere[];
  [field: string]: PrismaKeysetFilter | PrismaKeysetWhere[] | undefined;
};

export type PrismaKeysetOrderBy = Record<string, PrismaKeysetSortOrder>;

export type PrismaKeyset = {
  /** Render a portable keyset where AST to a Prisma `where` object. */
  where(where: KeysetWhere | null): PrismaKeysetWhere | undefined;
  /** Render portable keyset order keys to a Prisma `orderBy` array. */
  orderBy(order: KeysetSortKey[]): PrismaKeysetOrderBy[];
};

const PRISMA_FIELD = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function assertPrismaField(field: string): string {
  if (!PRISMA_FIELD.test(field)) {
    throw new Error(`assertPrismaField: invalid field "${field}" (use [a-zA-Z_][a-zA-Z0-9_]*)`);
  }
  return field;
}

const resolveField = (fields: PrismaKeysetFields, key: string): string => {
  const field = fields[key];
  if (field === undefined) {
    throw new Error(`toPrismaKeyset: missing field mapping for key "${key}"`);
  }
  return assertPrismaField(field);
};

const filterFor = (op: KeysetCompareOp, value: unknown): PrismaKeysetFilter => {
  switch (op) {
    case "eq":
      return { equals: value };
    case "gt":
      return { gt: value };
    case "lt":
      return { lt: value };
  }
};

/**
 * Create a Prisma adapter for portable keyset predicates and ordering.
 *
 * This adapter emits plain Prisma `where` and `orderBy` objects for scalar
 * fields. Prisma does not support arbitrary computed SQL expressions in its
 * typed query API; use `toKeysetWhereSql` + `$queryRawUnsafe` for expression
 * keysets that cannot be represented as scalar fields.
 *
 * @example
 * ```ts
 * import { toPrismaKeyset } from "@xtandard/lib/pagination/prisma";
 *
 * const prismaKeyset = toPrismaKeyset({
 *   createdAt: "createdAt",
 *   id: "id",
 * });
 *
 * const page = await prisma.post.findMany({
 *   where: prismaKeyset.where(keyset.where(cursor, direction)),
 *   orderBy: prismaKeyset.orderBy(keyset.orderBy(direction)),
 *   take: limit,
 * });
 * ```
 */
export function toPrismaKeyset(fields: PrismaKeysetFields): PrismaKeyset {
  const where = (keysetWhere: KeysetWhere | null): PrismaKeysetWhere | undefined => {
    if (keysetWhere == null) {
      return undefined;
    }

    return {
      OR: keysetWhere.or.map((branch) => {
        const parts = branch.and.map((pred): PrismaKeysetWhere => {
          const field = resolveField(fields, pred.key);
          return { [field]: filterFor(pred.op, pred.value) };
        });
        return parts.length === 1 ? parts[0]! : { AND: parts };
      }),
    };
  };

  const orderBy = (order: KeysetSortKey[]): PrismaKeysetOrderBy[] =>
    order.map((col) => ({ [resolveField(fields, col.key)]: col.order }));

  return { where, orderBy };
}
