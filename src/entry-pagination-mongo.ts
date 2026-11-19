/**
 * Mongo/Mongoose adapter for pagination keysets (no driver dependency).
 *
 * Import from `@xtandard/lib/pagination/mongo`.
 *
 * @module pagination/mongo
 */

export { assertMongoFieldPath, toMongoKeyset } from "./pagination-mongo.ts";
export type {
  MongoKeyset,
  MongoKeysetComparison,
  MongoKeysetFields,
  MongoKeysetFilter,
  MongoKeysetSort,
} from "./pagination-mongo.ts";
