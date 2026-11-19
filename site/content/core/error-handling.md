---
title: "Error handling"
description: "tryCatch turns throws and rejections into [data, error] tuples, sync or async. Plus assertNotNull, valueOrThrow and AssertError."
---

Use `tryCatch` to handle a failure as a value right where it happens instead of in a separate `try/catch`
block. Use `assertNotNull` for a value that must be present, where you want a typed, non-nullable result or an
immediate error.

```ts
import { tryCatch, assertNotNull, valueOrThrow, AssertError } from "@xtandard/lib";
```

## `tryCatch`

`tryCatch` runs a promise or a function and returns a `[data, error]` tuple instead of throwing:

- on success: `[data, null]`
- on failure: `[null, error]`

```ts
const [user, error] = await tryCatch(fetch("/api/me").then((r) => r.json()));

if (error) {
  console.error("could not load user", error);
} else {
  console.log(user.name);
}
```

Check `error` (or `data`) and TypeScript narrows the other half of the tuple.

### Sync or async, depending on the input

`tryCatch` is [sync/async-adaptive](@BASE@/guides/sync-async-adaptive/). What it returns depends on what you pass:

| Input                                                        | Returns                      |
| ------------------------------------------------------------ | ---------------------------- |
| a promise (any `PromiseLike`)                                | `Promise<[data, error]>`     |
| a function that returns a promise (e.g. an `async` function) | `Promise<[data, error]>`     |
| a sync function                                              | `[data, error]`, immediately |

```ts
// Sync function: the tuple is returned directly. No await, no microtask.
const [config, parseError] = tryCatch(() => JSON.parse('{"ok":true}'));

// Async function: a Promise of the tuple.
const [data, loadError] = await tryCatch(async () => {
  const res = await fetch("/api/data");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
});
```

The return type is worked out from the input, so you only need `await` when TypeScript says the result is a
Promise. If you `await` a sync result anyway, it still works.

:::tip[Prefer the function form]
`tryCatch(promise)` only catches the promise's rejection. When you call a function to _create_ the promise,
anything it throws before it returns the promise happens outside `tryCatch`. Pass a function instead,
`tryCatch(() => doWork())`, and `tryCatch` catches both the sync throw and the async rejection.
:::

TypeScript special-cases two return types: `any` (for example, `JSON.parse`) and `never` (a function that
always throws). Both still give you a tuple you can destructure, rather than an unusable type.

### Typing the error

The error type defaults to `Error`, but JavaScript can throw anything, and `tryCatch` returns whatever was
thrown or rejected without wrapping it:

```ts
const [, reason] = await tryCatch(Promise.reject("plain string"));
reason; // "plain string"; not an Error instance
```

Pass the second type parameter when you know the error shape:

```ts
class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

const [body, error] = await tryCatch<string, HttpError>(loadBody());
if (error) console.log(error.status);
```

The type parameter is not checked at runtime. It is a cast, so only use it when you know what can be thrown.

## `tryCatchSync` (deprecated)

`tryCatchSync(fn)` returns the `[data, error]` tuple for a sync function. Now that `tryCatch` returns sync
results directly for sync functions, `tryCatchSync` is redundant. It is kept only for backwards compatibility
and will be removed in a future major version. Replace it with `tryCatch`; the behaviour is the same:

```ts
const [value, error] = tryCatchSync(() => JSON.parse(text)); // before
const [value, error] = tryCatch(() => JSON.parse(text)); // after
```

## `assertNotNull`

`assertNotNull(value, message?)` returns `value` typed without `null` and `undefined`, or throws an
[`AssertError`](#asserterror) if the value is `null` or `undefined`.

```ts
const el = assertNotNull(document.querySelector("#app"), "#app is missing");
el.append("ready"); // el: Element (not Element | null)
```

Only `null` and `undefined` fail the check. Other falsy values are returned unchanged:

```ts
assertNotNull(0); // 0
assertNotNull(""); // ""
assertNotNull(false); // false
assertNotNull(null); // throws AssertError("unexpected null or undefined")
```

The default message is `"unexpected null or undefined"`.

## `valueOrThrow`

`valueOrThrow({ value, error, throwOnInvalid })` is for functions that should either return a fallback value
or throw, depending on a caller-supplied flag. With `throwOnInvalid: false` (the default) it returns
`value`. With `throwOnInvalid: true` it throws `error`: an `Error` instance is thrown as is, and a string is
wrapped in `new Error(string)`.

```ts
function parsePort(input: string, { strict = false } = {}): number | undefined {
  const port = Number(input);
  if (Number.isInteger(port) && port > 0 && port < 65536) return port;
  return valueOrThrow({
    value: undefined,
    error: `Invalid port: ${input}`,
    throwOnInvalid: strict,
  });
}

parsePort("http"); // undefined
parsePort("http", { strict: true }); // throws Error("Invalid port: http")
```

Call it only on the invalid path. It does no validation of its own: `throwOnInvalid: true` always throws.

## `AssertError`

`AssertError` is the `Error` subclass that `assertNotNull` throws. Its `name` is `"AssertError"`, so you can
tell it apart with `instanceof` or by name:

```ts
const [, error] = tryCatch(() => assertNotNull(maybeUser));

if (error instanceof AssertError) {
  // a missing value, not some other failure
}
```

You can throw it from your own checks too. Without an argument, its message is
`"The value is null or undefined"`.

```ts
throw new AssertError("expected at least one row");
```
