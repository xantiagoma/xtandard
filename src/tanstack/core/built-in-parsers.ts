import {
  type AnySingleParser,
  createMultiParser,
  createParser,
  type MultiParserWithDefault,
  type Parser,
} from "./parser.ts";
import { type StandardSchemaV1, validateWithStandardSchema } from "./standard-schema.ts";

export const parseAsString: Parser<string> = createParser({
  parse: (value) => value,
  serialize: (value) => value,
});

export const parseAsInteger: Parser<number> = createParser({
  parse: (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  },
  serialize: (value) => Math.round(value).toFixed(),
});

export const parseAsFloat: Parser<number> = createParser({
  parse: (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  },
  serialize: (value) => value.toString(),
});

export const parseAsHex: Parser<number> = createParser({
  parse: (value) => {
    const parsed = Number.parseInt(value, 16);
    return Number.isNaN(parsed) ? null : parsed;
  },
  serialize: (value) => Math.round(value).toString(16),
});

export const parseAsBoolean: Parser<boolean> = createParser({
  parse: (value) => value === "true",
  serialize: (value) => (value ? "true" : "false"),
});

/** URL is 1-indexed, state is 0-indexed: `?page=1` ⇄ `0`. */
export const parseAsIndex: Parser<number> = createParser({
  parse: (value) => {
    const parsed = parseAsInteger.parse(value);
    return parsed === null ? null : parsed - 1;
  },
  serialize: (value) => parseAsInteger.serialize(value + 1),
});

export const parseAsIsoDateTime: Parser<Date> = createParser({
  parse: (value) => {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date;
  },
  serialize: (value) => value.toISOString(),
  eq: (a, b) => a.valueOf() === b.valueOf(),
});

/** ISO date without time component (`YYYY-MM-DD`). */
export const parseAsIsoDate: Parser<Date> = createParser({
  parse: (value) => {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date;
  },
  serialize: (value) => value.toISOString().slice(0, 10),
  eq: (a, b) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10),
});

/** Unix epoch milliseconds. */
export const parseAsTimestamp: Parser<Date> = createParser({
  parse: (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  },
  serialize: (value) => value.valueOf().toString(),
  eq: (a, b) => a.valueOf() === b.valueOf(),
});

export function parseAsStringLiteral<T extends string>(values: readonly T[]): Parser<T> {
  const set = new Set<string>(values);
  const isMember = (value: string): value is T => set.has(value);
  return createParser({
    parse: (value) => (isMember(value) ? value : null),
    serialize: (value) => value,
  });
}

export function parseAsNumberLiteral<T extends number>(values: readonly T[]): Parser<T> {
  const set = new Set<number>(values);
  const isMember = (value: number): value is T => set.has(value);
  return createParser({
    parse: (value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && isMember(parsed) ? parsed : null;
    },
    serialize: (value) => value.toString(),
  });
}

export function parseAsStringEnum<E extends Record<string, string>>(
  enumObject: E,
): Parser<E[keyof E]> {
  const set = new Set<string>(Object.values(enumObject));
  const isMember = (value: string): value is E[keyof E] => set.has(value);
  return createParser({
    parse: (value) => (isMember(value) ? value : null),
    serialize: (value) => value,
  });
}

/** Comma-separated (configurable) array packed into a single key. */
export function parseAsArrayOf<T>(itemParser: AnySingleParser<T>, separator = ","): Parser<T[]> {
  const encodedSeparator = encodeURIComponent(separator);
  const decode = (part: string): string => part.split(encodedSeparator).join(separator);
  const encode = (part: string): string => part.split(separator).join(encodedSeparator);
  return createParser({
    parse: (value) => {
      if (value === "") return [];
      const parsed: T[] = [];
      for (const part of value.split(separator)) {
        const item = itemParser.parse(decode(part));
        if (item !== null) parsed.push(item);
      }
      return parsed;
    },
    serialize: (values) =>
      values.map((value) => encode(itemParser.serialize(value))).join(separator),
    eq: (a, b) =>
      a.length === b.length &&
      a.every((value, index) => {
        const other = b[index];
        return other !== undefined && itemParser.eq(value, other);
      }),
  });
}

/** Native URL arrays via repeated keys: `?tag=a&tag=b`. Defaults to `[]`. */
export function parseAsNativeArrayOf<T>(
  itemParser: AnySingleParser<T>,
): MultiParserWithDefault<T[]> {
  return createMultiParser<T[]>({
    parse: (values) => {
      const parsed: T[] = [];
      for (const value of values) {
        const item = itemParser.parse(value);
        if (item !== null) parsed.push(item);
      }
      return parsed;
    },
    serialize: (values) => values.map((value) => itemParser.serialize(value)),
    eq: (a, b) =>
      a.length === b.length &&
      a.every((value, index) => {
        const other = b[index];
        return other !== undefined && itemParser.eq(value, other);
      }),
  }).withDefault([]);
}

type JsonValidator<T> = StandardSchemaV1<unknown, T> | ((value: unknown) => T);

/**
 * JSON-encoded value. A runtime validator is required (Standard Schema or a
 * function that returns the value or throws); invalid input yields `null`.
 */
export function parseAsJson<T>(validator: JsonValidator<T>): Parser<T> {
  const validate =
    typeof validator === "function"
      ? validator
      : (value: unknown) => validateWithStandardSchema(validator, value);
  return createParser({
    parse: (value) => {
      let json: unknown;
      try {
        json = JSON.parse(value);
      } catch {
        return null;
      }
      try {
        return validate(json);
      } catch {
        return null;
      }
    },
    serialize: (value) => JSON.stringify(value),
    eq: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
}

/**
 * Validate the raw query string through a Standard Schema (Zod, Valibot,
 * ArkType, …) and return its output; invalid input → `null`. Best for scalar
 * params (`z.string().email()`, `z.coerce.number()`, `z.enum([...])`); for
 * structured values prefer `parseAsJson(schema)`. Validation must be sync.
 */
export function parseAsStandardSchema<T>(
  schema: StandardSchemaV1<unknown, T>,
  options?: { serialize?: (value: T) => string; eq?: (a: T, b: T) => boolean },
): Parser<T> {
  return createParser({
    parse: (value) => {
      try {
        return validateWithStandardSchema(schema, value);
      } catch {
        return null;
      }
    },
    serialize:
      options?.serialize ??
      ((value) => (typeof value === "string" ? value : JSON.stringify(value))),
    eq: options?.eq ?? ((a, b) => JSON.stringify(a) === JSON.stringify(b)),
  });
}

/**
 * A value codec: structured data ⇄ opaque token. Structurally matches
 * xtandard's `CursorCodec<T>` (from `createCursorCodec`), so a single codec —
 * with its own serializer/parser/encoder/decoder overrides — can back URL
 * state, pagination, and drizzle-cursor at once.
 *
 * Must be synchronous: URL parsing runs during render/SSR. Use the sync
 * `createCursorCodec` variant (the async one is for non-render code paths).
 */
export type ValueCodec<T> = {
  encode: (data: T) => string;
  decode: (token: string) => T;
};

/**
 * Store a structured value as an opaque token in the URL via a codec. Decode
 * failures fall back to `null` (the parser contract), so a tampered/stale token
 * resolves to the default instead of throwing.
 *
 *   const codec = createCursorCodec<{ id: number }>(); // JSON + base64url
 *   const [cursor, setCursor] = useQueryState("cursor", parseAsCodec(codec));
 */
export function parseAsCodec<T>(
  codec: ValueCodec<T>,
  options?: { eq?: (a: T, b: T) => boolean },
): Parser<T> {
  return createParser({
    serialize: (data: T) => codec.encode(data),
    parse: (token) => {
      try {
        return codec.decode(token);
      } catch {
        return null;
      }
    },
    // Default equality is by structure (deterministic), not by encoded form —
    // an encoder may be non-deterministic (e.g. encryption with a random IV).
    eq: options?.eq ?? ((a, b) => JSON.stringify(a) === JSON.stringify(b)),
  });
}

/**
 * Wrap a parser with a string transport layer — the encoder/decoder stage.
 * `encode` runs after the parser's `serialize`, `decode` before its `parse`.
 * Useful for base64url / signing on top of any existing parser. Apply
 * `.withDefault()` after wrapping.
 *
 *   import { encodeBase64Url, decodeBase64Url } from "@xtandard/lib";
 *   const opaque = withTransport(parseAsJson(schema), {
 *     encode: encodeBase64Url,
 *     decode: decodeBase64Url,
 *   });
 */
export function withTransport<T>(
  parser: AnySingleParser<T>,
  transport: { encode: (raw: string) => string; decode: (token: string) => string },
): Parser<T> {
  return createParser({
    serialize: (value: T) => transport.encode(parser.serialize(value)),
    parse: (token) => {
      let raw: string;
      try {
        raw = transport.decode(token);
      } catch {
        return null;
      }
      return parser.parse(raw);
    },
    eq: parser.eq,
  });
}
