/**
 * Prisma adapter for pagination keysets (no driver dependency).
 *
 * Import from `@xtandard/lib/pagination/prisma`.
 *
 * @module pagination/prisma
 */

export { assertPrismaField, toPrismaKeyset } from "./pagination-prisma.ts";
export type {
  PrismaKeyset,
  PrismaKeysetFields,
  PrismaKeysetFilter,
  PrismaKeysetOrderBy,
  PrismaKeysetSortOrder,
  PrismaKeysetWhere,
} from "./pagination-prisma.ts";
