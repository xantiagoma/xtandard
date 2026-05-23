import { AssertError } from "./errors";

export function assertNotNull<T>(
  value?: T | null | undefined,
  message = "unexpected null or undefined",
): T {
  if (value === null || value === undefined) {
    throw new AssertError(message);
  }
  return value;
}
