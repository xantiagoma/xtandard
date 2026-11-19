---
title: "Strings"
description: "ensureString for query params and headers, naturalSortCompare for human-friendly sorting, and jaroWinklerDistance for fuzzy matching."
---

Three small string helpers for jobs that come up often: reducing a value that may be a string or an array
of strings to one string, sorting strings that contain numbers the way people expect, and scoring how similar
two strings are.

```ts
import { ensureString, naturalSortCompare, jaroWinklerDistance } from "@xtandard/lib";
```

## `ensureString`

`ensureString(source)` takes a `string | string[] | null | undefined` and returns a single `string` or
`undefined`. For an array, it returns the **first** element.

```ts
ensureString("hello"); // "hello"
ensureString(["a", "b"]); // "a"
ensureString([]); // undefined
ensureString(null); // undefined
ensureString(undefined); // undefined
ensureString(""); // "" (empty strings are kept)
```

Use it for values that may arrive repeated, such as query parameters (`?tag=a&tag=b`), headers, or parsed
form fields, when you only want one value:

```ts
// e.g. Next.js searchParams, Express req.query, node:http headers
const page = Number(ensureString(searchParams.page) ?? "1");
const lang = ensureString(req.headers["accept-language"]);
```

## `naturalSortCompare`

`naturalSortCompare(a, b)` is a comparator for `Array.prototype.sort` that orders strings the way a file
manager does: runs of digits are compared as numbers, so `"file2"` comes before `"file10"`.

```ts
["file10", "file2", "file1"].sort(naturalSortCompare);
// ["file1", "file2", "file10"]

["v1.10", "v1.9", "v1.2"].sort(naturalSortCompare);
// ["v1.2", "v1.9", "v1.10"]
```

It is `a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })`. As a result:

- the comparison is **case- and accent-insensitive**: `"a"`, `"A"` and `"á"` compare as equal (`0`), so
  their order relative to each other is whatever it was before sorting;
- it uses the runtime's default locale (through `Intl`).

If you need a fixed locale, or a tie-break on case, call `localeCompare` (or an `Intl.Collator`) with your
own options.

## `jaroWinklerDistance`

`jaroWinklerDistance(a, b, options?)` returns the Jaro-Winkler **similarity** of two strings: a number from
`0` (nothing in common) to `1` (identical). Despite the name, a higher number means _more_ similar. The
Winkler adjustment raises the score of strings that share a prefix (up to 4 characters), which suits short
strings such as names and identifiers.

```ts
jaroWinklerDistance("martha", "marhta"); // ≈ 0.961
jaroWinklerDistance("dixon", "dicksonx"); // ≈ 0.813
jaroWinklerDistance("abc", "xyz"); // 0
```

It is **case-insensitive by default**. Pass `{ caseSensitive: true }` to compare exact characters:

```ts
jaroWinklerDistance("hello", "HELLO"); // 1
jaroWinklerDistance("hello", "HELLO", { caseSensitive: true }); // 0
```

A typical use is "did you mean…?" suggestions:

```ts
const commands = ["install", "uninstall", "update", "init"];

function suggest(input: string) {
  return commands
    .map((cmd) => ({ cmd, score: jaroWinklerDistance(input, cmd) }))
    .filter((s) => s.score > 0.85)
    .sort((x, y) => y.score - x.score)[0]?.cmd;
}

suggest("instal"); // "install"
```

:::note
If either string is empty, the result is `0`, even when both are empty. Check for empty input first if
`""` vs `""` should count as a match.
:::
