/**
 * Framework-free query-state parsers, serializer, loader and Standard Schema bridge. Zero dependencies.
 *
 * Import from `@xtandard/lib/tanstack/server`.
 *
 * @module tanstack/server
 */

export * from "./tanstack/server.ts";

// Types used by the public signatures above (not re-exported by the barrel).
export type { Eq } from "./tanstack/core/parser.ts";
export type { JsonValidator, Transport } from "./tanstack/core/built-in-parsers.ts";
export type { Base as SerializerBase } from "./tanstack/core/serializer.ts";
export type { SchemaInput } from "./tanstack/core/standard-schema.ts";
