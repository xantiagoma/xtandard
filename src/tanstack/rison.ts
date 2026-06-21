/**
 * A `query-params` {@link ValueCodec} backed by Rison
 * ([@effective/rison](https://github.com/effective-stack/rison)) + valibot.
 *
 * Opt-in subpath (`xantiagoma/tanstack/rison`): only this entry pulls in
 * `@effective/rison` and `valibot`.
 */

import { decode as risonDecode, encode as risonEncode } from "@effective/rison";
import * as v from "valibot";

import type { ValueCodec } from "./core/built-in-parsers.ts";

/**
 * A {@link ValueCodec} that stores a validated value as readable, canonical
 * Rison (stable key order → the same value always yields the same URL).
 * `encode` produces the Rison token; `decode` parses it and validates against
 * the valibot schema. Pair with `parseAsCodec` — it turns any throw (malformed
 * token or failed validation) into `null`, so a stale/tampered URL resolves to
 * the parser's default instead of crashing.
 *
 *   import { parseAsCodec } from "xantiagoma/tanstack";
 *   import { risonCodec } from "xantiagoma/tanstack/rison";
 *
 *   const filters = parseAsCodec(risonCodec(FiltersSchema));
 *   const [value, setValue] = useQueryState("filters", filters);
 */
export function risonCodec<S extends v.GenericSchema>(schema: S): ValueCodec<v.InferOutput<S>> {
  return {
    encode: (data) => risonEncode(data),
    decode: (token) => v.parse(schema, risonDecode(token)),
  };
}
