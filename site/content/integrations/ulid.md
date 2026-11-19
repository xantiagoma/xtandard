---
title: "ULID"
description: "Generate prefixed ULIDs like usr_01j..., and extract, validate and read the timestamp back out of them."
---

`@xtandard/lib/ulid` generates [ULIDs](https://github.com/ulid/spec) with an optional type prefix (`usr_01jd…`, `ord_01jd…`), Stripe-style. A prefix makes an id self-describing in logs and URLs, and ULIDs sort by creation time. The helpers take such an id apart again: get the bare ULID, check it, and read its creation time.

```sh
npm install @xtandard/lib ulid
```

```ts
import {
  ulid,
  getUlidFromId,
  isValidUlid,
  getTimestampFromUlid,
  getDateFromUlid,
} from "@xtandard/lib/ulid";
```

`ulid` (v2 or later) is an optional peer dependency.

## `ulid(prefix?)`

```ts
import { ulid } from "@xtandard/lib/ulid";

ulid(); // "01M7S7D8JQNAS4327M1E3VSVN5": plain ULID, uppercase
ulid("usr"); // "usr_01m7s7d8jq5f68evwsft46xett"
ulid("USR"); // "usr_01m7s7d8jqq7fej9j2j3hwgxe5"
```

With a prefix, the whole id is **lowercased**, ULID part included. ULIDs are case-insensitive, so this loses nothing, and the helpers below accept either case. An empty or `null` prefix gives a plain uppercase ULID.

:::caution[Don't put `_` in the prefix]
The helpers split the id on `_` and reject ids with more than one. `ulid("user_account")` generates `user_account_01…` without complaint, but `getUlidFromId` then returns `null` and `isValidUlid` returns `false` for it. Use prefixes like `usracct` or `user-account` instead.
:::

## Reading an id back

All four helpers take an object `{ id, throwOnInvalid? }` and work with prefixed or plain ids.

```ts
import {
  ulid,
  getUlidFromId,
  isValidUlid,
  getTimestampFromUlid,
  getDateFromUlid,
} from "@xtandard/lib/ulid";

const id = ulid("usr"); // "usr_01m7s7d8jq5f68evwsft46xett"

getUlidFromId({ id }); // "01M7S7D8JQ5F68EVWSFT46XETT": the ULID part, uppercased
isValidUlid({ id }); // true
getTimestampFromUlid({ id }); // 1795069223511 (epoch ms)
getDateFromUlid({ id }); // Date 2026-11-19T06:20:23.511Z
```

| Function               | Returns                                                   | On invalid input (`throwOnInvalid: false`)           |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| `getUlidFromId`        | The part after the prefix, uppercased. **Not validated.** | `null` for an empty id or one with more than one `_` |
| `isValidUlid`          | Whether that part is a well-formed 26-character ULID      | `false`                                              |
| `getTimestampFromUlid` | The creation time in epoch milliseconds                   | `null`                                               |
| `getDateFromUlid`      | The creation time as a `Date`                             | `null`                                               |

`getUlidFromId` only strips the prefix: `getUlidFromId({ id: "usr_hello" })` is `"HELLO"`. Call `isValidUlid` when you need to know that the value is a real ULID, e.g. when parsing a route param.

The timestamp is the moment the id was generated (ULIDs embed it in the first 10 characters). It is a convenient "created at" for debugging and coarse sorting; don't use it in place of a stored timestamp, since ids can be generated ahead of the insert.

### `throwOnInvalid`

Pass `throwOnInvalid: true` to get an `Error("Invalid ID format")` (or `"ID is required"`) instead of `null`:

```ts
const userId = getUlidFromId({ id: params.id, throwOnInvalid: true });
const createdAt = getDateFromUlid({ id: params.id, throwOnInvalid: true });
```

`getTimestampFromUlid` and `getDateFromUlid` throw for any invalid id. `isValidUlid` only throws when it can't extract a ULID part at all (empty id, too many `_`); for a malformed ULID it still returns `false`.

## See also

- API reference: [`ulid`](@BASE@/api/ulid/functions/ulid/), [`getUlidFromId`](@BASE@/api/ulid/functions/getulidfromid/), [`isValidUlid`](@BASE@/api/ulid/functions/isvalidulid/), [`getTimestampFromUlid`](@BASE@/api/ulid/functions/gettimestampfromulid/), [`getDateFromUlid`](@BASE@/api/ulid/functions/getdatefromulid/)
- Source: [`ulid-utils.ts`](@REPO@/blob/main/src/ulid-utils.ts)
