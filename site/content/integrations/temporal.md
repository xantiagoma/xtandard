---
title: "Temporal"
description: "Convert between Date, epoch numbers, strings and Temporal values, turn durations into milliseconds, and use Interval classes over the Temporal types."
---

`@xtandard/lib/temporal` helps code that sits between JavaScript `Date` and the TC39 `Temporal` API. It coerces the date-ish values you get from databases, JSON and users into a `Date` or a `Temporal.Instant`, converts durations to milliseconds, and exports `Interval` classes over the Temporal types.

```sh
npm install @xtandard/lib @js-temporal/polyfill
```

```ts
import { Temporal } from "@js-temporal/polyfill";
import {
  toDate,
  toInstant,
  toDuration,
  durationToMs,
  InstantInterval,
} from "@xtandard/lib/temporal";
```

`@js-temporal/polyfill` is an optional peer dependency.

## `Date` and `Temporal.Instant`

`dateToInstant` and `instantToDate` convert between the two exactly, by epoch milliseconds. Prefer them to `Temporal.Instant.from(date)`, which relies on coercing the `Date` to a string; these also fail loudly on bad input.

```ts
import { Temporal } from "@js-temporal/polyfill";
import { dateToInstant, instantToDate } from "@xtandard/lib/temporal";

dateToInstant(new Date("2025-01-01T00:00:00Z")).toString(); // "2025-01-01T00:00:00Z"
instantToDate(Temporal.Instant.from("2025-01-01T00:00:00Z")).toISOString(); // "2025-01-01T00:00:00.000Z"

dateToInstant(new Date("nope")); // throws RangeError("dateToInstant: invalid Date")
```

`instantToDate` throws a `RangeError` for an instant outside the range a `Date` can hold (±8.64e15 ms).

## `toDate` and `toInstant`: accept anything date-like

Both take a `DateLike` and normalize it:

```ts
type DateLike =
  | Date
  | Temporal.Instant
  | Temporal.ZonedDateTime
  | Temporal.PlainDateTime
  | Temporal.PlainDate
  | number // epoch milliseconds
  | string;
```

```ts
import { Temporal } from "@js-temporal/polyfill";
import { toDate, toInstant } from "@xtandard/lib/temporal";

toDate(1735689600000).toISOString(); // "2025-01-01T00:00:00.000Z"
toDate("2025-01-01").toISOString(); // "2025-01-01T00:00:00.000Z"
toDate("2025-01-01T09:00[America/New_York]").toISOString(); // "2025-01-01T14:00:00.000Z"
toDate(Temporal.PlainDate.from("2025-03-10")).toISOString(); // "2025-03-10T00:00:00.000Z"

toInstant("2025-01-01T12:00:00+02:00").toString(); // "2025-01-01T10:00:00Z"
toInstant(new Date(0)).toString(); // "1970-01-01T00:00:00Z"
toInstant("garbage"); // throws RangeError
```

Strings are tried, in order, as a `ZonedDateTime`, an `Instant`, a `PlainDateTime` and a `PlainDate`, and finally with `new Date(string)` as a last resort. Use them at boundaries where the input type isn't under your control (query params, CSV columns, mixed DB drivers), then keep a single type inside your code.

:::caution[Floating values are read as UTC]
Values without an offset or zone (a `PlainDate`, a `PlainDateTime`, or strings like `"2025-01-01"` and `"2025-01-01T09:00"`) are interpreted **in UTC**, not in the user's local zone. `toInstant("2025-01-01T09:00")` is `2025-01-01T09:00:00Z`. If the value is a local wall-clock time, attach the zone first, e.g. `plainDateTime.toZonedDateTime("Europe/Paris")`, and pass the `ZonedDateTime`.
:::

`toDate` always returns a new `Date` (a `Date` input is cloned). `toInstant` returns a `Temporal.Instant` input as-is.

## Durations

`toDuration` turns a `DurationLike` into a `Temporal.Duration`, and `durationToMs` turns one into milliseconds:

```ts
type DurationLike =
  | number /* milliseconds */
  | string /* ISO 8601, e.g. "PT2H" */
  | Temporal.Duration;
```

```ts
import { Temporal } from "@js-temporal/polyfill";
import { toDuration, durationToMs } from "@xtandard/lib/temporal";

toDuration(500).toString(); // "PT0.5S"
toDuration("PT2H").toString(); // "PT2H"

durationToMs("PT2H"); // 7_200_000
durationToMs(Temporal.Duration.from({ minutes: 15 })); // 900_000
durationToMs(1500); // 1500 (numbers are already ms)
```

This is handy for config values: store `"PT30M"` in a settings file or env var and get a number for `setTimeout` or a cache TTL.

Days, weeks, months and years are **calendar units**: their length in milliseconds depends on where you start counting (a month is 28 to 31 days). So a duration with any of them needs a reference point, `relativeTo` (any `DateLike`). Without one, `durationToMs` throws instead of guessing.

```ts
durationToMs("P1D"); // throws RangeError: relativeTo is required for calendar durations

durationToMs("P1D", { relativeTo: "2025-01-01T00:00:00Z" }); // 86_400_000
durationToMs("P1M", { relativeTo: "2025-02-01" }); // 2_419_200_000 (28 days)
durationToMs("P1M", { relativeTo: new Date("2025-01-01T00:00:00Z") }); // 2_678_400_000 (31 days)
```

`relativeTo` is evaluated in UTC, so a `P1D` is always 24 hours here.

## Temporal intervals

The entry also exports [`Interval`](@BASE@/interval/) classes bound to the Temporal types, plus their domains for `defineIntervalType` / `parseInterval`:

| Class                   | Element                  | Domain                | Kind             |
| ----------------------- | ------------------------ | --------------------- | ---------------- |
| `InstantInterval`       | `Temporal.Instant`       | `instantDomain`       | continuous       |
| `ZonedDateTimeInterval` | `Temporal.ZonedDateTime` | `zonedDateTimeDomain` | continuous       |
| `PlainDateInterval`     | `Temporal.PlainDate`     | `plainDateDomain`     | discrete (1 day) |
| `PlainDateTimeInterval` | `Temporal.PlainDateTime` | `plainDateTimeDomain` | continuous       |
| `PlainTimeInterval`     | `Temporal.PlainTime`     | `plainTimeDomain`     | continuous       |

```ts
import { Temporal } from "@js-temporal/polyfill";
import { PlainTimeInterval, InstantInterval, toInstant } from "@xtandard/lib/temporal";

const shift = PlainTimeInterval.closedOpen(
  Temporal.PlainTime.from("09:00"),
  Temporal.PlainTime.from("17:00"),
);
shift.contains(Temporal.PlainTime.from("12:30")); // true
shift.length(); // 28_800_000 (ms = 8h)
shift.toString(); // "[09:00:00,17:00:00)"

// The coercion helpers pair well with intervals over mixed inputs
const day = InstantInterval.closedOpen(
  toInstant("2025-01-01"),
  toInstant(new Date("2025-01-02T00:00:00Z")),
);
day.contains(toInstant(Date.parse("2025-01-01T12:00:00Z"))); // true
```

Comparisons are nanosecond-exact; `length()` and `middle()` are in milliseconds (days for `PlainDateInterval`). See [Interval domains → Temporal intervals](@BASE@/interval/domains/#temporal-intervals) for the precision rules, discrete merging of dates, and parsing.

## See also

- [Validation schemas](@BASE@/integrations/schemas/): valibot schemas for Temporal strings and an IANA `TimeZone` brand.
- API reference: [`toDate`](@BASE@/api/temporal/functions/todate/), [`toInstant`](@BASE@/api/temporal/functions/toinstant/), [`dateToInstant`](@BASE@/api/temporal/functions/datetoinstant/), [`instantToDate`](@BASE@/api/temporal/functions/instanttodate/), [`toDuration`](@BASE@/api/temporal/functions/toduration/), [`durationToMs`](@BASE@/api/temporal/functions/durationtoms/), [`DateLike`](@BASE@/api/temporal/type-aliases/datelike/)
- Source: [`datetime-utils.ts`](@REPO@/blob/main/src/datetime-utils.ts), [`duration-utils.ts`](@REPO@/blob/main/src/duration-utils.ts), [`interval-temporal.ts`](@REPO@/blob/main/src/interval-temporal.ts)
