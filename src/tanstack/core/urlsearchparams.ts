import type { AnyParser } from "./parser.ts";

// `keepSubDelims` lives in xtandard/web (generic, zero-dep) and is re-exported
// here for convenience since it pairs with the adapter's `serializeSearch`.
export { keepSubDelims } from "../../url-search-params-utils.ts";

/**
 * Whether a key is PRESENT in the URL but its raw value fails to parse — stale
 * or tampered junk that `clearOnInvalid` strips. An absent key is NOT invalid
 * (it just resolves to the default), so this returns `false` for it.
 */
export function hasInvalidKey<T>(
  params: URLSearchParams,
  key: string,
  parser: AnyParser<T>,
): boolean {
  if (parser.kind === "multi") {
    const raw = params.getAll(key);
    return raw.length > 0 && parser.parse(raw) === null;
  }

  const raw = params.get(key);
  return raw !== null && parser.parse(raw) === null;
}

/** Read and parse one key. Returns the default (or `null`) when absent/invalid. */
export function readKey<T>(params: URLSearchParams, key: string, parser: AnyParser<T>): T | null {
  const fallback = parser.hasDefault ? parser.defaultValue : null;
  if (parser.kind === "multi") {
    const raw = params.getAll(key);
    if (raw.length === 0) return fallback;
    return parser.parse(raw) ?? fallback;
  }
  const raw = params.get(key);
  if (raw === null) return fallback;
  return parser.parse(raw) ?? fallback;
}

/**
 * Write one key into `draft` (mutating it). `null` removes the key. When
 * `clearOnDefault` is on and the value equals the parser default, the key is
 * removed rather than serialized. Multi parsers write repeated keys.
 */
export function writeKey<T>(
  draft: URLSearchParams,
  key: string,
  parser: AnyParser<T>,
  value: T | null,
  clearOnDefault: boolean,
): void {
  draft.delete(key);
  if (value === null) return;
  if (clearOnDefault && parser.hasDefault && parser.eq(value, parser.defaultValue)) {
    return;
  }
  if (parser.kind === "multi") {
    for (const part of parser.serialize(value)) draft.append(key, part);
  } else {
    draft.set(key, parser.serialize(value));
  }
}

/** Stable primitive token for a key's raw value, for memoization deps. */
export function keyToken(
  params: URLSearchParams,
  key: string,
  kind: "single" | "multi",
): string | null {
  if (kind === "multi") {
    const all = params.getAll(key);
    return all.length === 0 ? null : JSON.stringify(all);
  }
  return params.get(key);
}

/** Normalize various inputs into a fresh `URLSearchParams`. */
export function toSearchParams(
  input: string | URLSearchParams | Record<string, string | string[] | undefined>,
): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  if (typeof input === "string") {
    const queryStart = input.indexOf("?");
    return new URLSearchParams(queryStart === -1 ? input : input.slice(queryStart));
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const part of value) params.append(key, part);
    } else {
      params.set(key, value);
    }
  }
  return params;
}
