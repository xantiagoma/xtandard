---
title: "Validation schemas"
description: "A branded IANA TimeZone schema for valibot, Zod, ArkType and Effect, plus valibot schemas for ISO durations and the Temporal string formats."
---

Four sibling entries ship small, ready-made schemas for the validator you already use. Each has a `TimeZoneSchema` that checks a string is a real IANA time zone and **brands** it as `TimeZone`. The valibot entry also has schemas for ISO 8601 durations and the Temporal date/time string formats. Use them at API boundaries (request bodies, query strings, settings) so the rest of your code can rely on the type.

| Entry                     | Install                                 | Exports                                                                                                                                                  |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@xtandard/lib/valibot`   | `valibot` (v1), `@js-temporal/polyfill` | `TimeZoneSchema`, `parseTimeZone`, `DurationSchema`, `InstantSchema`, `PlainDateSchema`, `PlainTimeSchema`, `PlainDateTimeSchema`, `ZonedDateTimeSchema` |
| `@xtandard/lib/zod`       | `zod` (v4)                              | `TimeZoneSchema`, `parseTimeZone`                                                                                                                        |
| `@xtandard/lib/arktype`   | `arktype` (v2)                          | `TimeZoneSchema`, `parseTimeZone`                                                                                                                        |
| `@xtandard/lib/effect`    | `effect` (v3.10+)                       | `TimeZoneSchema`, `parseTimeZone`                                                                                                                        |
| `@xtandard/lib/effect/v4` | `effect` (v4)                           | `TimeZoneSchema`, `parseTimeZone`                                                                                                                        |

Every entry also exports `isValidTimeZone`, `asTimeZone` and the `TimeZone` type. All peers are optional; install only the row you use. The valibot entry needs `@js-temporal/polyfill` too, because its Temporal schemas import it.

:::tip[Looking for filter schemas?]
The schemas for the filter model (`FiltersRequestSchema`, `FilterNodeSchema`, `SortSchema`, …) live at `@xtandard/lib/filters/{valibot,zod,arktype,effect}` (and `@xtandard/lib/filters/effect/v4` for effect 4). See [Filters → Validation](@BASE@/filters/#validation--ready-made-schemas-or-bring-your-own).
:::

## The `TimeZone` brand

`TimeZone` is `string` plus a nominal brand. A plain `string` isn't assignable to it, so a function that takes a `TimeZone` can only receive a value that went through validation:

```ts
import type { TimeZone } from "@xtandard/lib/valibot"; // same type from any of the four entries

function formatIn(timeZone: TimeZone, date: Date) {
  return date.toLocaleString("en-US", { timeZone }); // can't throw "Invalid time zone"
}

formatIn("Europe/Paris", new Date()); // type error: string is not a TimeZone
```

All four `TimeZoneSchema`s produce **the same** `TimeZone` type (type tests enforce it), so a zone validated with Zod in one service is accepted by code typed against the valibot entry.

Validity is checked with `Intl.DateTimeFormat`: if the runtime can format in that zone, it's valid. That means the result depends on the runtime's time-zone data, and that Intl's looser inputs pass too: `"utc"`, `"EST"` and offsets like `"+05:00"` are accepted. The value is **not canonicalized** (`"utc"` stays `"utc"`).

The dependency-free helpers are handy outside a schema:

```ts
import { isValidTimeZone, asTimeZone } from "@xtandard/lib/zod";

isValidTimeZone({ timeZone: "Asia/Tokyo" }); // { valid: true }
isValidTimeZone({ timeZone: "Mars/Olympus" }); // { valid: false }

const fromHeader = request.headers.get("x-time-zone") ?? "UTC";
const tz = isValidTimeZone({ timeZone: fromHeader }).valid
  ? asTimeZone(fromHeader)
  : asTimeZone("UTC");
```

`asTimeZone` only casts. It does not check anything, so call it after `isValidTimeZone` (every `TimeZoneSchema` does exactly that).

## valibot

```ts
import * as v from "valibot";
import { TimeZoneSchema, InstantSchema, DurationSchema } from "@xtandard/lib/valibot";

const MeetingSchema = v.object({
  title: v.string(),
  timeZone: TimeZoneSchema,
  startsAt: InstantSchema,
  length: DurationSchema,
});

v.parse(MeetingSchema, {
  title: "Standup",
  timeZone: "Europe/Paris",
  startsAt: "2026-06-18T18:00:00+02:00",
  length: "PT15M",
});
// { title: "Standup", timeZone: "Europe/Paris", startsAt: "2026-06-18T16:00:00Z", length: "PT15M" }

v.safeParse(DurationSchema, "15 minutes").issues?.[0].message;
// "Invalid duration (expected ISO-8601 like PT30M)"
```

The Temporal schemas each run the matching `Temporal.*.from` on a string. Invalid input becomes a normal valibot issue rather than a thrown `RangeError`. Valid input is **normalized to the canonical string**, not turned into a Temporal object: `"09:00"` becomes `"09:00:00"`, and an instant with an offset becomes UTC `Z`. Convert to Temporal yourself where you need one, e.g. `Temporal.Duration.from(meeting.length)` or [`durationToMs`](@BASE@/integrations/temporal/#durations).

| Schema                | Accepts                              | Example                                         |
| --------------------- | ------------------------------------ | ----------------------------------------------- |
| `DurationSchema`      | ISO 8601 duration                    | `"PT30M"`, `"P1DT2H"`                           |
| `InstantSchema`       | Date-time with offset or `Z`         | `"2026-06-18T16:00:00Z"`                        |
| `PlainDateSchema`     | Calendar date                        | `"2026-12-25"`                                  |
| `PlainTimeSchema`     | Wall-clock time                      | `"09:00"`, `"09:00:00"`                         |
| `PlainDateTimeSchema` | Date and time without a zone         | `"2026-12-25T09:00"`                            |
| `ZonedDateTimeSchema` | Date-time with a bracketed IANA zone | `"2026-06-18T09:00-07:00[America/Los_Angeles]"` |

`parseTimeZone(input)` is shorthand for `v.parse(TimeZoneSchema, input)`.

## Zod

```ts
import { z } from "zod";
import { TimeZoneSchema, parseTimeZone } from "@xtandard/lib/zod";

const SettingsSchema = z.object({ timeZone: TimeZoneSchema });

SettingsSchema.parse({ timeZone: "America/New_York" }); // { timeZone: "America/New_York" } (TimeZone)
SettingsSchema.safeParse({ timeZone: "Mars/Olympus" }).error?.issues[0]?.message; // "Invalid IANA time zone"

parseTimeZone("UTC"); // TimeZone; throws a ZodError when invalid
```

The schema is `z.string().refine(...).transform(asTimeZone)`: a string check followed by the brand.

## ArkType

```ts
import { type } from "arktype";
import { TimeZoneSchema, parseTimeZone } from "@xtandard/lib/arktype";

const Settings = type({ timeZone: TimeZoneSchema });

const out = Settings({ timeZone: "Mars/Olympus" });
if (out instanceof type.errors) {
  console.log(out.summary); // 'timeZone must be valid according to an anonymous predicate (was "Mars/Olympus")'
}

parseTimeZone("Asia/Tokyo"); // TimeZone; throws via .assert() when invalid
```

The ArkType schema has no custom message, so failures read "must be valid according to an anonymous predicate". Map them to your own wording if they reach users.

## Effect

Effect 4 changed the Schema API, so there are two entries with the same exports: `@xtandard/lib/effect` for effect 3 and `@xtandard/lib/effect/v4` for effect 4. Import the one that matches the `effect` major you have installed.

```ts
import { Either, Schema } from "effect";
import { TimeZoneSchema, parseTimeZone } from "@xtandard/lib/effect";

const Settings = Schema.Struct({ timeZone: TimeZoneSchema });

Schema.decodeUnknownSync(Settings)({ timeZone: "Europe/Berlin" }); // { timeZone: TimeZone }
Either.isLeft(Schema.decodeUnknownEither(Settings)({ timeZone: "Mars/Olympus" })); // true; message "Invalid IANA time zone"

parseTimeZone("Europe/Berlin"); // = Schema.decodeUnknownSync(TimeZoneSchema)
```

On effect 4, `Either` became `Result` and `ParseError` became `SchemaError`:

```ts
import { Result, Schema } from "effect";
import { TimeZoneSchema, parseTimeZone } from "@xtandard/lib/effect/v4";

const Settings = Schema.Struct({ timeZone: TimeZoneSchema });

Schema.decodeUnknownSync(Settings)({ timeZone: "Europe/Berlin" }); // { timeZone: TimeZone }
Result.isFailure(Schema.decodeUnknownResult(Settings)({ timeZone: "Mars/Olympus" })); // true; message "Invalid IANA time zone"

parseTimeZone("Mars/Olympus"); // throws SchemaError
```

On either version the Effect schema is a two-way transformation: its encoded side is a plain `string` and its type side is `TimeZone`, so `Schema.encodeSync` gives the string back.

## Which one?

| Library | Duration / Temporal schemas | Invalid-zone message                | `parseTimeZone` throws           |
| ------- | --------------------------- | ----------------------------------- | -------------------------------- |
| valibot | Yes                         | `Invalid IANA time zone`            | `ValiError`                      |
| Zod     | No                          | `Invalid IANA time zone`            | `ZodError`                       |
| ArkType | No                          | ArkType's generic predicate message | ArkType's `TraversalError`       |
| Effect  | No                          | `Invalid IANA time zone`            | `ParseError` (v4: `SchemaError`) |

Pick the one your project already uses; the `TimeZone` type is the same either way. If you need duration or Temporal string validation with Zod, ArkType or Effect, wrap `Temporal.*.from` in a refinement, or validate those fields with [`toDuration`](@BASE@/integrations/temporal/#durations) after parsing.

## See also

- [Temporal](@BASE@/integrations/temporal/): converting the validated strings into `Date`, `Temporal.Instant` and milliseconds.
- API reference: [valibot](@BASE@/api/valibot/), [zod](@BASE@/api/zod/), [arktype](@BASE@/api/arktype/), [effect](@BASE@/api/effect/), [effect/v4](@BASE@/api/effect/v4/)
- Source: [`timezone.ts`](@REPO@/blob/main/src/timezone.ts), [`temporal-schemas.ts`](@REPO@/blob/main/src/temporal-schemas.ts)
