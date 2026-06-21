import { describe, expect, test } from "vitest";

import { Interval } from "../src/interval";
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
