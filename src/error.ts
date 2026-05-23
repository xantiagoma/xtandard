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
