/**
 * Semantic-version intervals — the generic `Interval<T>` engine bound to
 * [semver](https://github.com/npm/node-semver) version strings. A version range
 * IS an interval: `[">=1.2.0", "<2.0.0")` is `closedOpen("1.2.0", "2.0.0")`. Use
 * it for compatibility windows, "affected versions" in advisories, release gates.
 * semver is a **peer dependency**.
 *
 * CONTINUOUS — prereleases (`1.0.0-rc.1 < 1.0.0`) mean there's no clean successor,
 * so no `next`/`prev` and no `length()`/`middle()`. Ordering, membership, and the
 * string form are exact (via semver precedence). Members must be valid semver;
 * `parse` normalizes (e.g. `"v1.2"` is rejected unless coercible — pass clean
 * versions). The value type is the version `string`.
 */

import { compare, valid } from "semver";

import { type BoundIntervalType, defineIntervalType, type IntervalDomain } from "./interval.ts";

/**
 * {@link IntervalDomain} ordering semver version strings by precedence. Continuous.
 * Invalid versions fail `isValid`; `parse` normalizes (`"v1.2.0"` → `"1.2.0"`).
 *
 * @example
 * ```ts
 * import { parseInterval } from "@xtandard/lib/interval";
 * import { semverDomain } from "@xtandard/lib/semver";
 *
 * semverDomain.compare("1.10.0", "1.9.0"); // 1 (numeric, not string, order)
 * parseInterval(semverDomain, "[1.0.0,2.0.0)").contains("1.0.0-rc.1"); // false
 * ```
 */
export const semverDomain: IntervalDomain<string> = {
  name: "semver",
  compare: (a, b) => compare(a, b),
  isValid: (value) => valid(value) !== null,
  format: (value) => value,
  parse: (text) => {
    const v = valid(text);
    if (v === null) throw new Error(`invalid semver: "${text}"`);

    return v;
  },
};

/**
 * Interval over semantic-version strings — exact precedence ordering, continuous.
 *
 * Membership is plain precedence, not npm range matching: `2.0.0-rc.1` sorts
 * below `2.0.0`, so it IS inside `[1.2.0,2.0.0)`, while npm's `>=1.2.0 <2.0.0`
 * excludes prereleases by default.
 *
 * @example
 * ```ts
 * import { SemverInterval } from "@xtandard/lib/semver";
 *
 * const compatible = SemverInterval.closedOpen("1.2.0", "2.0.0");
 * compatible.contains("1.5.3"); // true
 * compatible.contains("2.0.0"); // false
 * compatible.contains("2.0.0-rc.1"); // true (precedence, not npm range rules)
 * compatible.intersection(SemverInterval.atLeast("1.4.0")).toString(); // "[1.4.0,2.0.0)"
 * ```
 */
export const SemverInterval: BoundIntervalType<string> = defineIntervalType(semverDomain);
/** Instance type of {@link SemverInterval}. */
export type SemverInterval = InstanceType<typeof SemverInterval>;
