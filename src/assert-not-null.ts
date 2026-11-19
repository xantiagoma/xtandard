import { AssertError } from "./errors";

/**
 * Return `value` typed without `null` and `undefined`, or throw an
 * {@link AssertError} when it is `null` or `undefined`.
 *
 * Only `null` and `undefined` fail: other falsy values (`0`, `""`, `false`,
 * `NaN`) are returned unchanged.
 *
 * @param value - The value to check.
 * @param message - The `AssertError` message. Defaults to
 *   `"unexpected null or undefined"`.
 * @returns `value`, narrowed to `T`.
 * @throws {AssertError} When `value` is `null` or `undefined`.
 *
 * @example Narrow a nullable lookup
 * ```ts
 * import { assertNotNull } from "@xtandard/lib";
 *
 * const users = new Map([["ada", { name: "Ada" }]]);
 *
 * const ada = assertNotNull(users.get("ada"), "user ada is missing");
 * ada.name; // "Ada" (ada: { name: string }, not ... | undefined)
 *
 * assertNotNull(users.get("bob"), "user bob is missing");
 * // throws AssertError("user bob is missing")
 * ```
 *
 * @example Only null and undefined fail
 * ```ts
 * assertNotNull(0); // 0
 * assertNotNull(""); // ""
 * assertNotNull(false); // false
 * assertNotNull(null); // throws AssertError("unexpected null or undefined")
 * ```
 */
export function assertNotNull<T>(
  value?: T | null | undefined,
  message = "unexpected null or undefined",
): T {
  if (value === null || value === undefined) {
    throw new AssertError(message);
  }
  return value;
}
