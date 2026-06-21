/**
 * Server / framework-free entrypoint. No React, safe to import in loaders,
 * server functions, and `validateSearch`.
 */

export {
  createMultiParser,
  createParser,
  type AnyMultiParser,
  type AnyParser,
  type AnySingleParser,
  type inferParserMapType,
  type inferParserType,
  type MultiParser,
  type MultiParserWithDefault,
  type Parser,
  type ParserMap,
  type ParserWithDefault,
} from "./core/parser.ts";

export {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsCodec,
  parseAsFloat,
  parseAsHex,
  parseAsIndex,
  parseAsInteger,
  parseAsIsoDate,
  parseAsIsoDateTime,
  parseAsJson,
  parseAsNativeArrayOf,
  parseAsNumberLiteral,
  parseAsStandardSchema,
  parseAsString,
  parseAsStringEnum,
  parseAsStringLiteral,
  parseAsTimestamp,
  type ValueCodec,
  withTransport,
} from "./core/built-in-parsers.ts";

export {
  combineRateLimits,
  debounce,
  defaultRateLimit,
  throttle,
  type RateLimit,
} from "./core/rate-limit.ts";

export {
  combineResolvedOptions,
  LIBRARY_DEFAULTS,
  resolveOptions,
  type HistoryMode,
  type QueryStateOptions,
  type ResolvedOptions,
  type StartTransitionFn,
} from "./core/options.ts";

export {
  createSerializer,
  type CreateSerializerOptions,
  type SerializerValues,
} from "./core/serializer.ts";

export {
  createLoader,
  type CreateLoaderOptions,
  type LoaderInput,
  type LoadOptions,
} from "./core/loader.ts";

export { createStandardSchemaV1, validateWithStandardSchema } from "./core/standard-schema.ts";

export type { CreateStandardSchemaOptions, StandardSchemaV1 } from "./core/standard-schema.ts";

export { hasInvalidKey, keepSubDelims } from "./core/urlsearchparams.ts";
