/**
 * The `Error` subclass thrown by `assertNotNull`. Its `name` is
 * `"AssertError"`, so you can tell a failed assertion apart from other failures
 * with `instanceof` (or by `error.name`). Throw it from your own checks too.
 *
 * @example Tell a failed assertion apart from other errors
 * ```ts
 * import { AssertError, assertNotNull, tryCatch } from "@xtandard/lib";
 *
 * const [, error] = tryCatch(() => assertNotNull(null));
 *
 * error instanceof AssertError; // true
 * String(error); // "AssertError: unexpected null or undefined"
 * ```
 *
 * @example Throw it from your own check
 * ```ts
 * if (rows.length === 0) throw new AssertError("expected at least one row");
 * ```
 */
export class AssertError extends Error {
  /**
   * Creates an assertion error with the given message.
   *
   * @param message - The error message. Defaults to
   *   `"The value is null or undefined"` (note that `assertNotNull` passes its own
   *   default, `"unexpected null or undefined"`).
   *
   * @example
   * ```ts
   * new AssertError().message; // "The value is null or undefined"
   * new AssertError("expected at least one row").name; // "AssertError"
   * ```
   */
  constructor(message = "The value is null or undefined") {
    super(message);
    this.name = "AssertError";
  }
}
