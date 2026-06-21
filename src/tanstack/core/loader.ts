import type { inferParserMapType, ParserMap } from "./parser.ts";

import { readKey, toSearchParams } from "./urlsearchparams.ts";

export type LoaderInput =
  | string
  | URL
  | URLSearchParams
  | Request
  | Record<string, string | string[] | undefined>;

export type CreateLoaderOptions<M extends ParserMap> = {
  urlKeys?: Partial<Record<keyof M, string>>;
  /** Throw on values that are present but fail to parse. Default `false`. */
  strict?: boolean;
};

export type LoadOptions = { strict?: boolean };

function inputToSearchParams(input: Exclude<LoaderInput, Promise<unknown>>): URLSearchParams {
  if (input instanceof Request) return new URL(input.url).searchParams;
  if (input instanceof URL) return input.searchParams;
  return toSearchParams(input);
}

/**
 * Server-side parser. Accepts a URL string, query string, `URL`,
 * `URLSearchParams`, `Request`, a record, or a promise of any of those, and
 * returns the parsed values. In strict mode, present-but-invalid values throw.
 */
export function createLoader<M extends ParserMap>(
  parsers: M,
  loaderOptions?: CreateLoaderOptions<M>,
) {
  const urlKeyFor = (key: string): string => {
    const mapped = loaderOptions?.urlKeys?.[key];
    return typeof mapped === "string" ? mapped : key;
  };

  const parse = (params: URLSearchParams, strict: boolean): inferParserMapType<M> => {
    const result: Record<string, unknown> = {};
    for (const [key, parser] of Object.entries(parsers)) {
      const urlKey = urlKeyFor(key);
      if (strict) {
        if (parser.kind === "multi") {
          const raw = params.getAll(urlKey);
          if (raw.length > 0 && parser.parse(raw) === null) {
            throw new Error(`Invalid value for search param "${urlKey}"`);
          }
        } else {
          const raw = params.get(urlKey);
          if (raw !== null && parser.parse(raw) === null) {
            throw new Error(`Invalid value for search param "${urlKey}"`);
          }
        }
      }
      result[key] = readKey(params, urlKey, parser);
    }
    // Boundary cast: `result` is built from the parser map and matches
    // `inferParserMapType<M>` by construction.
    return result as inferParserMapType<M>;
  };

  function load(input: Promise<LoaderInput>, options?: LoadOptions): Promise<inferParserMapType<M>>;
  function load(input: LoaderInput, options?: LoadOptions): inferParserMapType<M>;
  function load(
    input: LoaderInput | Promise<LoaderInput>,
    options?: LoadOptions,
  ): inferParserMapType<M> | Promise<inferParserMapType<M>> {
    const strict = options?.strict ?? loaderOptions?.strict ?? false;
    if (input instanceof Promise) {
      return input.then((resolved) => parse(inputToSearchParams(resolved), strict));
    }
    return parse(inputToSearchParams(input), strict);
  }

  return load;
}
