/**
 * The **server-side options source** for a resource field — the runtime
 * counterpart of the serializable `FieldMetadata.options`/`optionsUrl` wire
 * contract (`./resource-metadata`). A field's options can be a **static list**
 * (a fixed enum) OR a **sync/async getter** (a relation backed by a DB query or
 * request), so the resource layer is only as async as its inputs.
 *
 * This is the "accept value | getter, normalize at the boundary" flavor of the
 * sync/async-adaptive pattern (see `docs/sync-async-adaptive.md`): `FieldOptions`
 * accepts all three forms, and `resolveFieldOptions` returns a `MaybePromise` —
 * the static/sync path never touches the microtask queue, and a consumer behind
 * an async boundary (an HTTP handler) just `await`s it.
 */

import type { MaybePromise } from "../types.ts";
import type { FieldOption } from "./resource-metadata.ts";

/** What an options getter receives when searching/resolving (a combobox). */
export interface OptionsQuery {
  /** Search term typed into the combobox. */
  q?: string;
  /** Resolve labels for already-selected ids (so chips render without searching). */
  ids?: string[];
}

/** A field's options: a static list, or a (sync OR async) getter that receives
 * an {@link OptionsQuery} — so options can come from a DB query/request. */
export type FieldOptions = FieldOption[] | ((query: OptionsQuery) => MaybePromise<FieldOption[]>);

/**
 * Resolve {@link FieldOptions} to its `FieldOption[]` — calling the getter (with
 * `query`) or returning the static list. Stays the color of its input: a static
 * list or sync getter resolves synchronously (no microtask), an async getter
 * yields a `Promise`. `await` works on either.
 */
export function resolveFieldOptions(input: {
  options: FieldOptions;
  query?: OptionsQuery;
}): MaybePromise<FieldOption[]> {
  return typeof input.options === "function" ? input.options(input.query ?? {}) : input.options;
}
