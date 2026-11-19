/**
 * Convert a `FormData` into a plain object. A key that appears once becomes a
 * single value; a key that appears more than once (checkbox groups,
 * multi-selects) becomes an array, in submission order.
 *
 * The type parameter is only a cast: nothing is validated or coerced, and
 * values stay `string` (or `File`). A field that can repeat comes back as a
 * single string when only one value was sent, so type it as
 * `string | string[]` or run the result through a schema.
 *
 * @example
 * ```ts
 * import { formDataToObject } from "@xtandard/lib/web";
 *
 * const form = new FormData();
 * form.append("name", "Ada");
 * form.append("tag", "math");
 * form.append("tag", "code");
 *
 * formDataToObject<{ name: string; tag: string | string[] }>(form);
 * // { name: "Ada", tag: ["math", "code"] }
 * ```
 */
export function formDataToObject<T = Record<string, unknown>>(formData: FormData): T {
  const object: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (object[key] !== undefined) {
      if (Array.isArray(object[key])) {
        object[key].push(value);
      } else {
        object[key] = [object[key], value];
      }
    } else {
      object[key] = value;
    }
  }

  return object as T;
}
