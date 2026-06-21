export { dateToInstant, instantToDate, toDate, toInstant } from "./datetime-utils.ts";
export type { DateLike } from "./datetime-utils.ts";

export { toDuration, durationToMs } from "./duration-utils.ts";
export type { DurationLike } from "./duration-utils.ts";

// Temporal interval domains + ready-made interval classes, built on the generic
// Interval<T> engine (see xtandard/interval and docs/INTERVAL.md).
export {
  InstantInterval,
  instantDomain,
  PlainDateInterval,
  plainDateDomain,
  PlainDateTimeInterval,
  plainDateTimeDomain,
  PlainTimeInterval,
  plainTimeDomain,
  ZonedDateTimeInterval,
  zonedDateTimeDomain,
} from "./interval-temporal.ts";
