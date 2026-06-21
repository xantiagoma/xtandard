/**
 * Compile-time inference assertions for the public `xantiagoma/tanstack` types.
 * Not a runtime test: this `*.test-d.ts` file is statically type-checked by
 * `tsc --noEmit` (via `bun run check`), so it fails the build if the public
 * parser inference regresses. Uses `type-testing` (`Expect`/`Equal`) — the same
 * assertion vocabulary Zod / tRPC / TanStack use.
 *
 * Assertions are `export`ed so they don't trip unused-declaration lint.
 */
import type { Equal, Expect } from "type-testing";

import type {
  inferParserMapType,
  inferParserType,
  MultiParserWithDefault,
  Parser,
  ParserWithDefault,
} from "../src/tanstack/core/parser.ts";
import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsNativeArrayOf,
  parseAsString,
} from "../src/tanstack/server.ts";

// --- inferParserType: variant → return type ---------------------------------

// Plain parser → value | null
export type _Plain = Expect<Equal<inferParserType<Parser<number>>, number | null>>;

// .withDefault() → non-null value
export type _Default = Expect<Equal<inferParserType<ParserWithDefault<number>>, number>>;

// Multi parser with a built-in default ([] always present) → T[]
export type _Native = Expect<Equal<inferParserType<MultiParserWithDefault<string[]>>, string[]>>;

// --- concrete built-in parsers ----------------------------------------------

export type _StringParser = Expect<Equal<typeof parseAsString, Parser<string>>>;
export type _IntegerWithDefault = Expect<
  Equal<inferParserType<ReturnType<typeof parseAsInteger.withDefault>>, number>
>;
export type _NativeArray = Expect<
  Equal<inferParserType<ReturnType<typeof parseAsNativeArrayOf<string>>>, string[]>
>;

// --- inferParserMapType: map → resolved object ------------------------------

type Map = {
  q: typeof parseAsString;
  page: ReturnType<typeof parseAsInteger.withDefault>;
  tags: ReturnType<typeof parseAsNativeArrayOf<string>>;
};

export type _Map = Expect<
  Equal<inferParserMapType<Map>, { q: string | null; page: number; tags: string[] }>
>;

// --- server helpers infer the same map type --------------------------------

const map = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(0),
};

// createLoader(map)(input) → resolved map values
export type _LoaderReturn = Expect<
  Equal<ReturnType<ReturnType<typeof createLoader<typeof map>>>, { q: string; page: number }>
>;

// createSerializer(map) → callable producing a string
export type _SerializerReturn = Expect<
  Equal<ReturnType<ReturnType<typeof createSerializer<typeof map>>>, string>
>;
