/**
 * nuqs-style typed URL query state for TanStack Router (peers `react`, `@tanstack/react-router`).
 *
 * Import from `@xtandard/lib/tanstack`.
 *
 * @module tanstack
 */

export * from "./tanstack/index.ts";

// Types used by the public signatures above (not re-exported by the barrels).
export type { Eq } from "./tanstack/core/parser.ts";
export type { JsonValidator, Transport } from "./tanstack/core/built-in-parsers.ts";
export type { Base as SerializerBase } from "./tanstack/core/serializer.ts";
export type { SchemaInput } from "./tanstack/core/standard-schema.ts";
export type { ReadValue } from "./tanstack/react/use-query-state.ts";

// Store factory + contract, for building third-party adapters on QueryStateAdapterContext.
export { createQueryStateStore } from "./tanstack/core/store.ts";
export type {
  CommitFn,
  CommitInput,
  QueryStateStore,
  Snapshot,
  StoreUpdate,
} from "./tanstack/core/store.ts";
