/**
 * Compile-time drift guards for every ready-made schema subpath (`/valibot`,
 * `/zod`, `/arktype`, `/effect`). Each schema's inferred OUTPUT must equal the
 * `@xtandard/lib/filters` model type — so a model change that isn't mirrored in a
 * schema fails `tsc --noEmit` (via `bun run check`). Not run by the test runner.
 */
import type { Equal, Expect } from "type-testing";

import type { FieldFilter, FilterNode, FiltersRequest, Sort } from "../src/filters/types.ts";

// ── valibot (ready-made) ─────────────────────────────────────────────────────
import type * as v from "valibot";
import type {
  FieldFilterSchema as ValibotFieldFilter,
  FilterNodeSchema as ValibotFilterNode,
  FiltersRequestSchema as ValibotFiltersRequest,
  SortSchema as ValibotSort,
} from "../src/filters/schemas.ts";

export type _ValibotField = Expect<Equal<v.InferOutput<typeof ValibotFieldFilter>, FieldFilter>>;
export type _ValibotRequest = Expect<
  Equal<v.InferOutput<typeof ValibotFiltersRequest>, FiltersRequest>
>;
export type _ValibotNode = Expect<Equal<v.InferOutput<typeof ValibotFilterNode>, FilterNode>>;
export type _ValibotSort = Expect<Equal<v.InferOutput<typeof ValibotSort>, Sort>>;

// ── zod ──────────────────────────────────────────────────────────────────────
import type { z } from "zod";
import type {
  FieldFilterSchema as ZodFieldFilter,
  FilterNodeSchema as ZodFilterNode,
  FiltersRequestSchema as ZodFiltersRequest,
  SortSchema as ZodSort,
} from "../src/filters/schemas-zod.ts";

export type _ZodField = Expect<Equal<z.infer<typeof ZodFieldFilter>, FieldFilter>>;
export type _ZodRequest = Expect<Equal<z.infer<typeof ZodFiltersRequest>, FiltersRequest>>;
export type _ZodNode = Expect<Equal<z.infer<typeof ZodFilterNode>, FilterNode>>;
export type _ZodSort = Expect<Equal<z.infer<typeof ZodSort>, Sort>>;

// ── effect ───────────────────────────────────────────────────────────────────
import type { Schema } from "effect";
import type {
  FieldFilterSchema as EffectFieldFilter,
  FilterNodeSchema as EffectFilterNode,
  FiltersRequestSchema as EffectFiltersRequest,
  SortSchema as EffectSort,
} from "../src/filters/schemas-effect.ts";

export type _EffectField = Expect<Equal<Schema.Schema.Type<typeof EffectFieldFilter>, FieldFilter>>;
export type _EffectRequest = Expect<
  Equal<Schema.Schema.Type<typeof EffectFiltersRequest>, FiltersRequest>
>;
export type _EffectNode = Expect<Equal<Schema.Schema.Type<typeof EffectFilterNode>, FilterNode>>;
export type _EffectSort = Expect<Equal<Schema.Schema.Type<typeof EffectSort>, Sort>>;

// ── arktype ──────────────────────────────────────────────────────────────────
import type {
  FieldFilterSchema as ArkFieldFilter,
  FilterNodeSchema as ArkFilterNode,
  FiltersRequestSchema as ArkFiltersRequest,
  SortSchema as ArkSort,
} from "../src/filters/schemas-arktype.ts";

export type _ArkField = Expect<Equal<(typeof ArkFieldFilter)["infer"], FieldFilter>>;
export type _ArkRequest = Expect<Equal<(typeof ArkFiltersRequest)["infer"], FiltersRequest>>;
export type _ArkNode = Expect<Equal<(typeof ArkFilterNode)["infer"], FilterNode>>;
export type _ArkSort = Expect<Equal<(typeof ArkSort)["infer"], Sort>>;
