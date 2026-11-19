/**
 * Return a fallback value or throw, depending on a caller-supplied flag. Call it
 * on the invalid path of a function that offers both a lenient and a strict mode.
 *
 * - `throwOnInvalid: false` (the default): returns `value`.
 * - `throwOnInvalid: true`: throws `error`. An `Error` instance is thrown as is;
 *   a string is wrapped in `new Error(error)`.
 *
 * It does no validation of its own: with `throwOnInvalid: true` it always throws.
 *
 * @example A parser with a strict mode
 * ```ts
 * import { valueOrThrow } from "@xtandard/lib";
 *
 * function parsePort(input: string, { strict = false } = {}) {
 *   const port = Number(input);
 *   if (Number.isInteger(port) && port > 0 && port < 65536) return port;
 *   return valueOrThrow({
 *     value: undefined,
 *     error: `Invalid port: ${input}`,
 *     throwOnInvalid: strict,
 *   });
 * }
 *
 * parsePort("8080"); // 8080
 * parsePort("http"); // undefined
 * parsePort("http", { strict: true }); // throws Error("Invalid port: http")
 * ```
 *
 * @example Throw your own error class
 * ```ts
 * valueOrThrow({ value: null, error: new TypeError("bad input"), throwOnInvalid: true });
 * // throws the TypeError itself
 * ```
 */
export function valueOrThrow<T>({
  value,
  error,
  throwOnInvalid = false,
}: {
  value: T;
  error: Error | string;
  throwOnInvalid?: boolean;
}): T {
  if (!throwOnInvalid) {
    return value;
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(error);
}
