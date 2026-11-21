import { describe, expect, test } from "vitest";

import { Interval } from "../src/interval";
import { IntervalMap } from "../src/interval-map";
import { IntervalSet } from "../src/interval-set";
import { SemverInterval, semverDomain } from "../src/interval-semver";

describe("SemverInterval — version ranges (continuous)", () => {
  test("a compatibility window", () => {
    const r = SemverInterval.closedOpen("1.2.0", "2.0.0");
    expect(r.toString()).toBe("[1.2.0,2.0.0)");
    expect(r.contains("1.5.3")).toBe(true);
    expect(r.contains("1.2.0")).toBe(true);
    expect(r.contains("2.0.0")).toBe(false); // open upper
    expect(r.contains("1.1.9")).toBe(false);
    expect(r.isDiscrete).toBe(false);
  });

  test("precedence: prerelease sorts below its release", () => {
    expect(SemverInterval.closedOpen("1.0.0", "2.0.0").contains("1.0.0-rc.1")).toBe(false); // rc < 1.0.0
    expect(SemverInterval.closed("1.0.0-rc.1", "1.0.0").contains("1.0.0-rc.5")).toBe(true);
  });

  test("set operations + encloses", () => {
    expect(
      SemverInterval.closed("1.0.0", "2.0.0").encloses(SemverInterval.closed("1.5.0", "1.9.0")),
    ).toBe(true);
    expect(
      SemverInterval.closed("1.0.0", "1.5.0")
        .intersection(SemverInterval.closed("1.3.0", "2.0.0"))
        .toString(),
    ).toBe("[1.3.0,1.5.0]");
  });

  test("parse round-trips; invalid versions are rejected", () => {
    expect(SemverInterval.parse("[1.2.0,2.0.0)").toString()).toBe("[1.2.0,2.0.0)");
    expect(() => SemverInterval.parse("[1.2,2.0.0)")).toThrow(/invalid semver/); // "1.2" is not valid semver
    expect(semverDomain.name).toBe("semver");
    expect(semverDomain.next).toBeUndefined(); // continuous
  });

  test("length is null (continuous, no natural measure)", () => {
    expect(SemverInterval.closed("1.0.0", "2.0.0").length()).toBeNull();
  });

  test("instanceof", () => {
    const r = SemverInterval.closed("1.0.0", "2.0.0");
    expect(r).toBeInstanceOf(SemverInterval);
    expect(r).toBeInstanceOf(Interval);
  });
});

describe("IntervalSet / IntervalMap over semver", () => {
  test("affected versions and per-range support status", () => {
    const affected = IntervalSet.of(SemverInterval.domain, [
      SemverInterval.closedOpen("1.2.0", "1.4.3"),
      SemverInterval.closedOpen("2.0.0", "2.1.1"),
    ]);
    expect(affected.contains("1.3.9")).toBe(true);
    expect(affected.contains("1.4.3")).toBe(false);
    expect(affected.toString()).toBe("[1.2.0,1.4.3) ∪ [2.0.0,2.1.1)");
    expect(
      affected.complement().subSet(SemverInterval.closedOpen("1.0.0", "3.0.0")).toString(),
    ).toBe("[1.0.0,1.2.0) ∪ [1.4.3,2.0.0) ∪ [2.1.1,3.0.0)");

    const support = IntervalMap.of(SemverInterval.domain, [
      [SemverInterval.closedOpen("1.0.0", "2.0.0"), "maintenance"],
      [SemverInterval.atLeast("2.0.0"), "active"],
    ]);
    expect(support.get("1.9.0")).toBe("maintenance");
    expect(support.get("2.3.0")).toBe("active");
    expect(support.get("0.9.0")).toBeUndefined();
  });
});
