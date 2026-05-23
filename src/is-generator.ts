import { isAsyncIterable } from "./is-async-iterable";

/**
 * Type guard for sync `Generator`.
 *
 * Distinguishes a Generator (from `function*`) from plain iterators by checking
 * for the presence of `next`, `return`, and `throw` methods, while ensuring
 * it's not an async generator.
 *
 * @example
 * ```ts
 * function* gen() {
 *   yield 1;
 *   yield 2;
 *   return "done";
 * }
 *
 * const value = gen();
 *
 * if (isGenerator<number, string>(value)) {
 *   let result = value.next();
 *   while (!result.done) {
 *     console.log(result.value); // 1, 2
 *     result = value.next();
 *   }
 *   console.log(result.value); // "done"
 * }
 * ```
 */
export function isGenerator<T = unknown, TReturn = unknown>(
  value: unknown,
): value is Generator<T, TReturn, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "next" in value &&
    typeof (value as Generator<T, TReturn>).next === "function" &&
    "return" in value &&
    typeof (value as Generator<T, TReturn>).return === "function" &&
    "throw" in value &&
    typeof (value as Generator<T, TReturn>).throw === "function" &&
    !isAsyncIterable(value)
  );
}
