import type { KeysetCompareOp, KeysetSortKey, KeysetWhere } from "./keyset.ts";

export type MongoKeysetFields = Record<string, string>;

export type MongoKeysetComparison = {
  $gt?: unknown;
  $lt?: unknown;
};

export type MongoKeysetFilter = {
  $and?: MongoKeysetFilter[];
  $or?: MongoKeysetFilter[];
  [field: string]: MongoKeysetComparison | MongoKeysetFilter[] | unknown;
};

export type MongoKeysetSort = Record<string, 1 | -1>;

export type MongoKeyset = {
  /** Render a portable keyset where AST to a Mongo/Mongoose filter object. */
  filter(where: KeysetWhere | null): MongoKeysetFilter | undefined;
  /** Render portable keyset order keys to a Mongo/Mongoose sort object. */
  sort(order: KeysetSortKey[]): MongoKeysetSort;
};

const MONGO_FIELD_PATH = /^[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;

/**
 * Validate a Mongo field path used by the keyset adapter.
 *
 * Accepts dotted paths such as `author.name`; rejects `$` operators,
 * whitespace, empty segments, and other unsafe field strings. Field mappings
 * must be server-owned and should never come from request data.
 */
export function assertMongoFieldPath(field: string): string {
  if (!MONGO_FIELD_PATH.test(field)) {
    throw new Error(
      `assertMongoFieldPath: invalid field path "${field}" (use dot-separated identifiers)`,
    );
  }
  return field;
}

const resolveField = (fields: MongoKeysetFields, key: string): string => {
  const field = fields[key];
  if (field === undefined) {
    throw new Error(`toMongoKeyset: missing field mapping for key "${key}"`);
  }
  return assertMongoFieldPath(field);
};

const filterFor = (op: KeysetCompareOp, value: unknown): unknown => {
  switch (op) {
    case "eq":
      return value;
    case "gt":
      return { $gt: value };
    case "lt":
      return { $lt: value };
  }
};

/**
 * Create a MongoDB/Mongoose adapter for portable keyset predicates and sorting.
 *
 * The adapter emits plain filter/sort objects suitable for MongoDB driver and
 * Mongoose APIs: `Model.find(filter).sort(sort).limit(limit)`.
 *
 * @example
 * ```ts
 * import { toMongoKeyset } from "@xtandard/lib/pagination/mongo";
 *
 * const mongoKeyset = toMongoKeyset({
 *   createdAt: "createdAt",
 *   id: "_id",
 * });
 *
 * const items = await Post
 *   .find(mongoKeyset.filter(keyset.where(cursor, direction)) ?? {})
 *   .sort(mongoKeyset.sort(keyset.orderBy(direction)))
 *   .limit(limit);
 * ```
 */
export function toMongoKeyset(fields: MongoKeysetFields): MongoKeyset {
  const filter = (keysetWhere: KeysetWhere | null): MongoKeysetFilter | undefined => {
    if (keysetWhere == null) {
      return undefined;
    }

    return {
      $or: keysetWhere.or.map((branch) => {
        const parts = branch.and.map((pred): MongoKeysetFilter => {
          const field = resolveField(fields, pred.key);
          return { [field]: filterFor(pred.op, pred.value) };
        });
        return parts.length === 1 ? parts[0]! : { $and: parts };
      }),
    };
  };

  const sort = (order: KeysetSortKey[]): MongoKeysetSort =>
    Object.fromEntries(
      order.map((col) => [resolveField(fields, col.key), col.order === "asc" ? 1 : -1]),
    );

  return { filter, sort };
}
