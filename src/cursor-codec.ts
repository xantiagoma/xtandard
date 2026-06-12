import type { MaybePromise } from "./types.ts";
import { chainMaybePromise } from "./resolve-maybe-promise.ts";

/**
 * An opaque-cursor codec: turns cursor data (a plain object) into a string
 * token safe to hand to clients, and back. Fully synchronous variant.
 */
export type CursorCodec<T = Record<string, unknown>> = {
  encode: (data: T) => string;
  decode: (token: string) => T;
};

/**
 * Cursor codec whose stages may be asynchronous (e.g. WebCrypto encryption),
 * so `encode`/`decode` may return Promises.
 */
export type CursorCodecMaybeAsync<T = Record<string, unknown>> = {
  encode: (data: T) => MaybePromise<string>;
  decode: (token: string) => MaybePromise<T>;
};

/**
 * The codec pipeline is two independently pluggable stages
 * (signature-compatible with `drizzle-cursor`'s options, so the same
 * overrides can be shared between both libraries):
 *
 * ```
 * data ──serializer──▶ string ──encoder──▶ token
 * data ◀───parser───── string ◀──decoder── token
 * ```
 *
 * All-sync stages variant — produces a fully synchronous `CursorCodec`.
 */
export type CursorCodecOptionsSync<T = Record<string, unknown>> = {
  /** Converts cursor data to a string. Default: `JSON.stringify`. */
  serializer?: (data: T) => string;
  /** Converts a string back to cursor data. Default: `JSON.parse`. */
  parser?: (raw: string) => T;
  /** Makes the serialized string opaque/transport-safe. Default: base64url. */
  encoder?: (str: string) => string;
  /** Reverses `encoder`. Default: base64url decode. */
  decoder?: (token: string) => string;
  /**
   * Revive top-level ISO-8601 date/datetime strings into `Date` objects on
   * decode (matching `drizzle-cursor`'s parse behavior). Default: `true`.
   */
  reviveDates?: boolean;
};

/**
 * Codec options where any stage may return a Promise (e.g. an encrypting
 * encoder backed by `crypto.subtle`).
 */
export type CursorCodecOptions<T = Record<string, unknown>> = {
  serializer?: (data: T) => MaybePromise<string>;
  parser?: (raw: string) => MaybePromise<T>;
  encoder?: (str: string) => MaybePromise<string>;
  decoder?: (token: string) => MaybePromise<string>;
  reviveDates?: boolean;
};

/**
 * Encode a UTF-8 string as base64url (no padding). Unlike `btoa`, handles
 * non-Latin1 input; unlike `Buffer`, works in browsers and edge runtimes.
 */
export function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/**
 * Decode a base64url (or plain base64) string back to UTF-8.
 */
export function decodeBase64Url(token: string): string {
  const base64 = token.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

const ISO_DATE_TIME_REGEX =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Check whether a value is an ISO-8601 date or datetime string
 * (`YYYY-MM-DD`, optionally with time and `Z`/offset) that the host engine
 * can actually parse.
 */
export function isIsoDateString(value: unknown): value is string {
  return (
    typeof value === "string" && ISO_DATE_TIME_REGEX.test(value) && !Number.isNaN(Date.parse(value))
  );
}

/**
 * Create an opaque-cursor codec. Defaults to `JSON` + base64url, every stage
 * replaceable — swap the encoder/decoder pair for encryption or signing, or
 * the serializer/parser pair for superjson/msgpack-style formats.
 *
 * Sync/async adaptive: all-sync stages (including the defaults) produce a
 * `CursorCodec` whose `encode`/`decode` return plain values; if any stage is
 * async the codec returns Promises — reflected in the types.
 *
 * `Date` values survive a round-trip out of the box: `JSON.stringify` emits
 * ISO strings and `decode` revives them (disable with `reviveDates: false`).
 *
 * @example Default codec (sync)
 * ```ts
 * const codec = createCursorCodec();
 * const token = codec.encode({ id: 7, createdAt: new Date() }); // string
 * const data = codec.decode(token); // { id: 7, createdAt: Date }
 * ```
 *
 * @example Async stage (WebCrypto) — encode/decode become Promise-returning
 * ```ts
 * const codec = createCursorCodec({
 *   encoder: (s) => encryptWithSubtleCrypto(s), // returns Promise<string>
 *   decoder: (t) => decryptWithSubtleCrypto(t),
 * });
 * const token = await codec.encode({ id: 7 });
 * ```
 *
 * @example Sharing custom stages with drizzle-cursor
 * ```ts
 * const codec = createCursorCodec({ encoder, decoder });
 * const cursor = generateCursor(config, { encoder, decoder }); // drizzle-cursor
 * // tokens produced by either parse cleanly in the other
 * ```
 */
export function createCursorCodec<T extends Record<string, unknown> = Record<string, unknown>>(
  options?: CursorCodecOptionsSync<T>,
): CursorCodec<T>;
export function createCursorCodec<T extends Record<string, unknown> = Record<string, unknown>>(
  options: CursorCodecOptions<T>,
): CursorCodecMaybeAsync<T>;
export function createCursorCodec<T extends Record<string, unknown> = Record<string, unknown>>(
  options: CursorCodecOptions<T> = {},
): CursorCodecMaybeAsync<T> {
  const {
    serializer = JSON.stringify as (data: T) => string,
    parser = JSON.parse as (raw: string) => T,
    encoder = encodeBase64Url,
    decoder = decodeBase64Url,
    reviveDates = true,
  } = options;

  return {
    encode: (data) => chainMaybePromise(serializer(data), encoder),
    decode: (token) =>
      chainMaybePromise(chainMaybePromise(decoder(token), parser), (data) => {
        if (reviveDates && data && typeof data === "object") {
          const record = data as Record<string, unknown>;
          for (const [key, value] of Object.entries(record)) {
            if (isIsoDateString(value)) {
              record[key] = new Date(value);
            }
          }
        }
        return data;
      }),
  };
}
