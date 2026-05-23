export function* enumerate<T>(iterable: Iterable<T>, start = 0): Generator<[number, T]> {
  let index = start;
  for (const value of iterable) {
    yield [index, value];
    index += 1;
  }
}

export async function* enumerateAsync<T>(
  iterable: AsyncIterable<T> | Iterable<T>,
  start = 0,
): AsyncGenerator<[number, T]> {
  let index = start;
  for await (const value of iterable) {
    yield [index, value];
    index += 1;
  }
}
