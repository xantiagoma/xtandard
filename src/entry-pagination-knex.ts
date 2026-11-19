/**
 * Knex adapter for pagination keysets (raw parameterized SQL, no driver dependency).
 *
 * Import from `@xtandard/lib/pagination/knex`.
 *
 * @module pagination/knex
 */

export { applyKeysetToKnex } from "./pagination-knex.ts";
export type { ApplyKeysetToKnexOptions, KnexKeysetQuery } from "./pagination-knex.ts";
