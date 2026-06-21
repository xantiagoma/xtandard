import type { QueryStateOptions } from "./options.ts";

/**
 * Parser model.
 *
 * `T` is always the non-null value type (e.g. `number`, `Date`, `string[]`).
 * Whether the hook can return `null` is encoded by the parser variant, not by
 * `T`: a plain parser yields `T | null`, a `.withDefault()` parser yields `T`.
 *
 * `kind` distinguishes single-value parsers (one query key, `params.get`) from
 * multi-value parsers (repeated keys, `params.getAll`).
 */

type Eq<T> = (a: T, b: T) => boolean;

function mergeOptions(
  base: QueryStateOptions | undefined,
  extra: QueryStateOptions,
): QueryStateOptions {
  return { ...base, ...extra };
}

// --- Single-value parsers --------------------------------------------------

export interface Parser<T> {
  readonly kind: "single";
  readonly hasDefault: false;
  readonly defaultValue: undefined;
  readonly options: QueryStateOptions | undefined;
  parse: (value: string) => T | null;
  serialize: (value: T) => string;
  eq: Eq<T>;
  withDefault: (defaultValue: T) => ParserWithDefault<T>;
  withOptions: (options: QueryStateOptions) => Parser<T>;
}

export interface ParserWithDefault<T> {
  readonly kind: "single";
  readonly hasDefault: true;
  readonly defaultValue: T;
  readonly options: QueryStateOptions | undefined;
  parse: (value: string) => T | null;
  serialize: (value: T) => string;
  eq: Eq<T>;
  withDefault: (defaultValue: T) => ParserWithDefault<T>;
  withOptions: (options: QueryStateOptions) => ParserWithDefault<T>;
}

type SingleState<T> = {
  parse: (value: string) => T | null;
  serialize: (value: T) => string;
  eq: Eq<T>;
  options: QueryStateOptions | undefined;
};

function single<T>(state: SingleState<T>): Parser<T> {
  return {
    kind: "single",
    hasDefault: false,
    defaultValue: undefined,
    options: state.options,
    parse: state.parse,
    serialize: state.serialize,
    eq: state.eq,
    withDefault: (defaultValue) => singleWithDefault({ ...state, defaultValue }),
    withOptions: (options) => single({ ...state, options: mergeOptions(state.options, options) }),
  };
}

function singleWithDefault<T>(state: SingleState<T> & { defaultValue: T }): ParserWithDefault<T> {
  return {
    kind: "single",
    hasDefault: true,
    defaultValue: state.defaultValue,
    options: state.options,
    parse: state.parse,
    serialize: state.serialize,
    eq: state.eq,
    withDefault: (defaultValue) => singleWithDefault({ ...state, defaultValue }),
    withOptions: (options) =>
      singleWithDefault({
        ...state,
        options: mergeOptions(state.options, options),
      }),
  };
}

export function createParser<T>(builder: {
  parse: (value: string) => T | null;
  serialize?: (value: T) => string;
  eq?: Eq<T>;
}): Parser<T> {
  return single({
    parse: builder.parse,
    serialize: builder.serialize ?? ((value) => String(value)),
    eq: builder.eq ?? ((a, b) => a === b),
    options: undefined,
  });
}

// --- Multi-value parsers (repeated keys) -----------------------------------

export interface MultiParser<T> {
  readonly kind: "multi";
  readonly hasDefault: false;
  readonly defaultValue: undefined;
  readonly options: QueryStateOptions | undefined;
  parse: (values: string[]) => T | null;
  serialize: (value: T) => string[];
  eq: Eq<T>;
  withDefault: (defaultValue: T) => MultiParserWithDefault<T>;
  withOptions: (options: QueryStateOptions) => MultiParser<T>;
}

export interface MultiParserWithDefault<T> {
  readonly kind: "multi";
  readonly hasDefault: true;
  readonly defaultValue: T;
  readonly options: QueryStateOptions | undefined;
  parse: (values: string[]) => T | null;
  serialize: (value: T) => string[];
  eq: Eq<T>;
  withDefault: (defaultValue: T) => MultiParserWithDefault<T>;
  withOptions: (options: QueryStateOptions) => MultiParserWithDefault<T>;
}

type MultiState<T> = {
  parse: (values: string[]) => T | null;
  serialize: (value: T) => string[];
  eq: Eq<T>;
  options: QueryStateOptions | undefined;
};

function multi<T>(state: MultiState<T>): MultiParser<T> {
  return {
    kind: "multi",
    hasDefault: false,
    defaultValue: undefined,
    options: state.options,
    parse: state.parse,
    serialize: state.serialize,
    eq: state.eq,
    withDefault: (defaultValue) => multiWithDefault({ ...state, defaultValue }),
    withOptions: (options) => multi({ ...state, options: mergeOptions(state.options, options) }),
  };
}

function multiWithDefault<T>(
  state: MultiState<T> & { defaultValue: T },
): MultiParserWithDefault<T> {
  return {
    kind: "multi",
    hasDefault: true,
    defaultValue: state.defaultValue,
    options: state.options,
    parse: state.parse,
    serialize: state.serialize,
    eq: state.eq,
    withDefault: (defaultValue) => multiWithDefault({ ...state, defaultValue }),
    withOptions: (options) =>
      multiWithDefault({
        ...state,
        options: mergeOptions(state.options, options),
      }),
  };
}

export function createMultiParser<T>(builder: {
  parse: (values: string[]) => T | null;
  serialize: (value: T) => string[];
  eq?: Eq<T>;
}): MultiParser<T> {
  return multi({
    parse: builder.parse,
    serialize: builder.serialize,
    eq: builder.eq ?? ((a, b) => a === b),
    options: undefined,
  });
}

// --- Unions & inference ----------------------------------------------------

export type AnySingleParser<T> = Parser<T> | ParserWithDefault<T>;
export type AnyMultiParser<T> = MultiParser<T> | MultiParserWithDefault<T>;
export type AnyParser<T> = AnySingleParser<T> | AnyMultiParser<T>;

/** Map a parser type to the value its hook returns. */
export type inferParserType<P> =
  P extends ParserWithDefault<infer T>
    ? T
    : P extends MultiParserWithDefault<infer T>
      ? T
      : P extends Parser<infer T>
        ? T | null
        : P extends MultiParser<infer T>
          ? T | null
          : never;

// `any` (not `unknown`) in this constraint position so concrete parsers like
// `Parser<number>` satisfy it — `Parser<T>` is contravariant in `T` (via
// `serialize`/`eq`/`withDefault`), so it does not extend `Parser<unknown>`.
// oxlint-disable-next-line typescript/no-explicit-any
export type ParserMap = Record<string, AnyParser<any>>;

export type inferParserMapType<M extends ParserMap> = {
  [K in keyof M]: inferParserType<M[K]>;
};
