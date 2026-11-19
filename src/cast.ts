/**
 * Return `value` typed as `T`. The same as `value as T`: an unchecked type
 * assertion with no runtime effect. As a function call it fits in expression
 * chains and is easy to search for.
 *
 * Nothing is validated, so only use it when you know the shape. When the data
 * might not match, use a schema or a type guard instead.
 *
 * @example
 * ```ts
 * import { cast } from "@xtandard/lib";
 *
 * type AppConfig = { port: number };
 *
 * const config = cast<AppConfig>(JSON.parse('{"port":8080}'));
 * config.port; // 8080 (config: AppConfig, not any)
 * ```
 */
export function cast<T>(value: unknown): T {
  return value as T;
}
