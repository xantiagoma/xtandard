import {
  type AnySingleParser,
  createMultiParser,
  createParser,
  type MultiParserWithDefault,
  type Parser,
} from "./parser.ts";
import { type StandardSchemaV1, validateWithStandardSchema } from "./standard-schema.ts";

/**
 * Identity parser: the raw query value as a `string`. Any present value
 * parses, so add `.withDefault("")` to get a non-null `string`.
 *
 * @example
 * ```ts
 * import { parseAsString, useQueryState } from "@xtandard/lib/tanstack";
 *
 * parseAsString.parse("hello"); // → "hello"
 *
 * // ?q=shoes → "shoes"; no ?q → ""
 * const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
 * ```
 */
export const parseAsString: Parser<string> = createParser({
  parse: (value) => value,
  serialize: (value) => value,
});

/**
 * Base-10 integer (`Number.parseInt`). A value with no leading digits parses
 * to `null`; trailing junk is ignored (`"42abc"` → `42`). Serializes rounded.
 *
 * @example
 * ```ts
 * import { parseAsInteger } from "@xtandard/lib/tanstack";
 *
 * parseAsInteger.parse("42"); // → 42
 * parseAsInteger.parse("abc"); // → null
 * parseAsInteger.serialize(3.7); // → "4"
 *
 * const page = parseAsInteger.withDefault(1); // ?page=3 → 3, no ?page → 1
 * ```
 */
export const parseAsInteger: Parser<number> = createParser({
  parse: (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  },
  serialize: (value) => Math.round(value).toFixed(),
});

/**
 * Floating-point number (`Number.parseFloat`); a non-numeric value parses to `null`.
 *
 * @example
 * ```ts
 * import { parseAsFloat } from "@xtandard/lib/tanstack";
 *
 * parseAsFloat.parse("1.5"); // → 1.5
 * parseAsFloat.parse("x"); // → null
 * parseAsFloat.serialize(0.25); // → "0.25"
 * ```
 */
export const parseAsFloat: Parser<number> = createParser({
  parse: (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  },
  serialize: (value) => value.toString(),
});

/**
 * Integer stored as hexadecimal (no `0x` prefix), e.g. for colors. Serializes rounded.
 *
 * @example
 * ```ts
 * import { parseAsHex } from "@xtandard/lib/tanstack";
 *
 * parseAsHex.parse("ff"); // → 255
 * parseAsHex.serialize(255); // → "ff"
 * parseAsHex.parse("zz"); // → null
 * ```
 */
export const parseAsHex: Parser<number> = createParser({
  parse: (value) => {
    const parsed = Number.parseInt(value, 16);
    return Number.isNaN(parsed) ? null : parsed;
  },
  serialize: (value) => Math.round(value).toString(16),
});

/**
 * `"true"` ⇄ `true`, `"false"` ⇄ `false`.
 *
 * Note: it never returns `null` for a present key. Any value other than
 * `"true"` (`?on=yes`, `?on=1`) parses to `false`, so `clearOnInvalid`
 * never strips it.
 *
 * @example
 * ```ts
 * import { parseAsBoolean } from "@xtandard/lib/tanstack";
 *
 * parseAsBoolean.parse("true"); // → true
 * parseAsBoolean.parse("yes"); // → false
 * parseAsBoolean.serialize(true); // → "true"
 *
 * const showArchived = parseAsBoolean.withDefault(false);
 * ```
 */
export const parseAsBoolean: Parser<boolean> = createParser({
  parse: (value) => value === "true",
  serialize: (value) => (value ? "true" : "false"),
});

/**
 * Page index: the URL is 1-indexed, state is 0-indexed (`?page=1` ⇄ `0`).
 * Fits TanStack Table's `pageIndex` while keeping human-friendly URLs.
 *
 * @example
 * ```ts
 * import { parseAsIndex } from "@xtandard/lib/tanstack";
 *
 * parseAsIndex.parse("1"); // → 0
 * parseAsIndex.parse("3"); // → 2
 * parseAsIndex.serialize(0); // → "1"
 *
 * const pageIndex = parseAsIndex.withDefault(0); // no ?page → 0
 * ```
 */
export const parseAsIndex: Parser<number> = createParser({
  parse: (value) => {
    const parsed = parseAsInteger.parse(value);
    return parsed === null ? null : parsed - 1;
  },
  serialize: (value) => parseAsInteger.serialize(value + 1),
});

/**
 * `Date` stored as a full ISO-8601 timestamp (`toISOString()`, UTC).
 * Anything `new Date(value)` can't read parses to `null`. Equality is by time value.
 *
 * @example
 * ```ts
 * import { parseAsIsoDateTime } from "@xtandard/lib/tanstack";
 *
 * parseAsIsoDateTime.parse("2026-06-18T16:00:00Z"); // → Date 2026-06-18T16:00:00.000Z
 * parseAsIsoDateTime.serialize(new Date("2026-06-18T16:00:00Z"));
 * // → "2026-06-18T16:00:00.000Z"
 * parseAsIsoDateTime.parse("nope"); // → null
 * ```
 */
export const parseAsIsoDateTime: Parser<Date> = createParser({
  parse: (value) => {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date;
  },
  serialize: (value) => value.toISOString(),
  eq: (a, b) => a.valueOf() === b.valueOf(),
});

/**
 * `Date` stored as an ISO date without a time component (`YYYY-MM-DD`).
 * `"2026-12-25"` parses to UTC midnight; serializing and equality use the
 * UTC calendar day, so two `Date`s on the same UTC day are equal.
 *
 * @example
 * ```ts
 * import { parseAsIsoDate } from "@xtandard/lib/tanstack";
 *
 * parseAsIsoDate.parse("2026-12-25"); // → Date 2026-12-25T00:00:00.000Z
 * parseAsIsoDate.serialize(new Date("2026-12-25T15:30:00Z")); // → "2026-12-25"
 * ```
 */
export const parseAsIsoDate: Parser<Date> = createParser({
  parse: (value) => {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date;
  },
  serialize: (value) => value.toISOString().slice(0, 10),
  eq: (a, b) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10),
});

/**
 * `Date` stored as Unix epoch milliseconds.
 *
 * @example
 * ```ts
 * import { parseAsTimestamp } from "@xtandard/lib/tanstack";
 *
 * parseAsTimestamp.parse("1781798400000"); // → Date 2026-06-18T16:00:00.000Z
 * parseAsTimestamp.serialize(new Date("2026-06-18T16:00:00Z")); // → "1781798400000"
 * ```
 */
export const parseAsTimestamp: Parser<Date> = createParser({
  parse: (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  },
  serialize: (value) => value.valueOf().toString(),
  eq: (a, b) => a.valueOf() === b.valueOf(),
});

/**
 * One of a fixed list of strings, typed as their union. Anything else parses to `null`.
 *
 * @example
 * ```ts
 * import { parseAsStringLiteral } from "@xtandard/lib/tanstack";
 *
 * const sortOrder = parseAsStringLiteral(["asc", "desc"] as const); // Parser<"asc" | "desc">
 * sortOrder.parse("asc"); // → "asc"
 * sortOrder.parse("up"); // → null
 *
 * const order = sortOrder.withDefault("asc");
 * ```
 */
export function parseAsStringLiteral<T extends string>(values: readonly T[]): Parser<T> {
  const set = new Set<string>(values);
  const isMember = (value: string): value is T => set.has(value);
  return createParser({
    parse: (value) => (isMember(value) ? value : null),
    serialize: (value) => value,
  });
}

/**
 * One of a fixed list of numbers, typed as their union. Anything else parses to `null`.
 *
 * @example
 * ```ts
 * import { parseAsNumberLiteral } from "@xtandard/lib/tanstack";
 *
 * const pageSize = parseAsNumberLiteral([10, 25, 50] as const); // Parser<10 | 25 | 50>
 * pageSize.parse("25"); // → 25
 * pageSize.parse("30"); // → null
 * pageSize.serialize(50); // → "50"
 * ```
 */
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

/**
 * A value of a string `enum` (or any `Record<string, string>`), matched by
 * the enum's values, not its keys. Anything else parses to `null`.
 *
 * @example
 * ```ts
 * import { parseAsStringEnum } from "@xtandard/lib/tanstack";
 *
 * enum Status {
 *   Open = "open",
 *   Done = "done",
 * }
 *
 * const status = parseAsStringEnum(Status); // Parser<Status>
 * status.parse("open"); // → Status.Open ("open")
 * status.parse("archived"); // → null
 * ```
 */
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

/**
 * Array packed into a single key, comma-separated by default (`?ids=1,2,3`).
 * Each item goes through `itemParser`; items that fail to parse are dropped
 * (`"1,x,3"` → `[1, 3]`), and an empty value is `[]`. A separator inside an
 * item is percent-encoded so it round-trips.
 *
 * @example
 * ```ts
 * import { parseAsArrayOf, parseAsInteger, parseAsString } from "@xtandard/lib/tanstack";
 *
 * const ids = parseAsArrayOf(parseAsInteger);
 * ids.parse("1,2,3"); // → [1, 2, 3]
 * ids.serialize([1, 2, 3]); // → "1,2,3"
 *
 * parseAsArrayOf(parseAsString, "|").serialize(["a", "b"]); // → "a|b"
 * ```
 */
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

/**
 * Native URL arrays via repeated keys: `?tag=a&tag=b`. A multi-value parser
 * that already has `.withDefault([])` applied. Items that fail `itemParser`
 * are dropped.
 *
 * Under `shallow: false` TanStack Router re-serializes search globally, so
 * prefer {@link parseAsArrayOf} for loader/SSR-bound arrays.
 *
 * @example
 * ```ts
 * import { createSerializer, parseAsNativeArrayOf, parseAsString } from "@xtandard/lib/tanstack";
 *
 * const tags = parseAsNativeArrayOf(parseAsString);
 * tags.parse(["a", "b"]); // → ["a", "b"]
 * tags.defaultValue; // → []
 *
 * createSerializer({ tag: tags })({ tag: ["a", "b"] }); // → "?tag=a&tag=b"
 * ```
 */
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
 * function that returns the value or throws); malformed JSON or a failed
 * validation yields `null`. Validation must be sync. Equality compares
 * `JSON.stringify` output.
 *
 * @example With a Standard Schema
 * ```ts
 * import { parseAsJson } from "@xtandard/lib/tanstack";
 * import * as v from "valibot";
 *
 * const filters = parseAsJson(v.object({ status: v.picklist(["open", "done"]) }));
 * filters.parse('{"status":"open"}'); // → { status: "open" }
 * filters.parse('{"status":"nope"}'); // → null
 * filters.serialize({ status: "done" }); // → '{"status":"done"}'
 * ```
 *
 * @example With a validator function
 * ```ts
 * const count = parseAsJson((value) => {
 *   if (typeof value !== "number") throw new Error("not a number");
 *   return value;
 * });
 * count.parse("42"); // → 42
 * count.parse('"x"'); // → null
 * ```
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
 *
 * Without `options.serialize`, strings are written as-is and other values as
 * JSON; equality defaults to comparing `JSON.stringify` output.
 *
 * @example
 * ```ts
 * import { parseAsStandardSchema } from "@xtandard/lib/tanstack";
 * import { z } from "zod";
 *
 * const email = parseAsStandardSchema(z.string().email());
 * email.parse("ada@example.com"); // → "ada@example.com"
 * email.parse("nope"); // → null
 *
 * const qty = parseAsStandardSchema(z.coerce.number().int().min(1));
 * qty.parse("3"); // → 3
 * qty.parse("0"); // → null
 * qty.serialize(3); // → "3"
 * ```
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
 * Equality defaults to comparing `JSON.stringify` of the decoded values (not
 * the tokens, since an encoder may be non-deterministic); pass `options.eq` to override.
 *
 * @example With a cursor codec
 * ```ts
 * import { createCursorCodec } from "@xtandard/lib/pagination";
 * import { parseAsCodec, useQueryState } from "@xtandard/lib/tanstack";
 *
 * const cursor = parseAsCodec(createCursorCodec<{ id: number }>()); // JSON + base64url
 * cursor.serialize({ id: 42 }); // → "eyJpZCI6NDJ9"
 * cursor.parse("eyJpZCI6NDJ9"); // → { id: 42 }
 * cursor.parse("!!!"); // → null (tampered token)
 *
 * const [after, setAfter] = useQueryState("after", cursor);
 * ```
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
 * `.withDefault()` after wrapping (the wrapper drops the inner parser's
 * default and options). A `decode` that throws yields `null`.
 *
 * @example
 * ```ts
 * import { decodeBase64Url, encodeBase64Url } from "@xtandard/lib/pagination";
 * import { parseAsJson, withTransport } from "@xtandard/lib/tanstack";
 * import * as v from "valibot";
 *
 * const filters = withTransport(parseAsJson(v.object({ status: v.string() })), {
 *   encode: encodeBase64Url,
 *   decode: decodeBase64Url,
 * });
 * filters.serialize({ status: "open" }); // → "eyJzdGF0dXMiOiJvcGVuIn0"
 * filters.parse("eyJzdGF0dXMiOiJvcGVuIn0"); // → { status: "open" }
 * ```
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
