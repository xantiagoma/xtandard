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
