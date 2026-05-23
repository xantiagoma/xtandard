/**
 * Log values to the console while preserving useful TypeScript inference.
 *
 * - `log()` returns `undefined`
 * - `log(value)` returns the same value (typed)
 * - `log(a, b, c)` returns a typed tuple of arguments
 *
 * @example
 * ```ts
 * let a = log(5);
 * a // : number
 *
 * let b = log({ v: "Hola" });
 * b // : { v: string; }
 *
 * let c = log();
 * c // : undefined
 *
 * let d = log(1, 2);
 * d // : [number, number]
 *
 * let e = log([1, 2]);
 * e // : number[]
 *
 * let f = log([1, 2], [3, 4]);
 * f // : [number[], number[]]
 *
 * let g = log(...[1, 2, 3, { a: 5 }]);
 * g // : [number, number, number, { a: number }]
 *
 * let h = log(...[1, 2, 3, 4], ...[5, 6, 7, 8]);
 * h // : [number, number, number, number, number, number, number, number]
 *
 * let val = Math.random() < 0.5 ? [1, 2, 3] : ["a", "b", "c"];
 * let i = log(...val);
 * i // : number[] | string[]
 *
 * let val2 = Math.random() < 0.5 ? [1, 2, 3, "a"] : ["a", "b", "c"];
 * let j = log(...val2);
 * j // : (string | number)[]
 * ```
 */
export function log(): undefined;
export function log<T>(arg: T): T;
export function log<T extends readonly unknown[]>(...args: T): T;
export function log<T>(...args: T[]): T[] | T | undefined {
  console.log(...args);
  if (args.length === 0) {
    return;
  }
  if (args.length === 1) {
    return args[0];
  }
  return args;
}
