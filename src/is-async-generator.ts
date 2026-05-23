/**
 * Type guard for `AsyncGenerator`.
 *
 * Distinguishes an AsyncGenerator (from `async function*`) from plain async
 * iterators by checking for `Symbol.asyncIterator`, `next`, and `return` methods.
 *
 * @example
 * ```ts
 * async function* gen() {
 *   yield 1;
 *   yield 2;
 *   return "done";
 * }
 *
 * const value = gen();
 *
 * if (isAsyncGenerator<number, string>(value)) {
 *   let result = await value.next();
 *   while (!result.done) {
 *     console.log(result.value); // 1, 2
 *     result = await value.next();
 *   }
 *   console.log(result.value); // "done"
 * }
 * ```
 */
export function isAsyncGenerator<T = unknown, TReturn = unknown>(
  value: unknown,
): value is AsyncGenerator<T, TReturn, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value &&
    "next" in value &&
    typeof (value as AsyncGenerator<T, TReturn>).next === "function" &&
    "return" in value &&
    typeof (value as AsyncGenerator<T, TReturn>).return === "function"
  );
}
