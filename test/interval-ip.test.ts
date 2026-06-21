import { describe, expect, test } from "vitest";

import { Interval } from "../src/interval";
import { Ipv4Interval, Ipv6Interval } from "../src/interval-ip";

describe("Ipv4Interval (discrete, ε = one address)", () => {
  test("CIDR block: contains / length / toString", () => {
    const lan = Ipv4Interval.cidr("192.168.0.0/16");
    expect(lan.toString()).toBe("[192.168.0.0,192.168.255.255]");
    expect(lan.contains(Ipv4Interval.ip("192.168.1.50"))).toBe(true);
    expect(lan.contains(Ipv4Interval.ip("10.0.0.1"))).toBe(false);
    expect(lan.length()).toBe(65536);
    expect(lan.isDiscrete).toBe(true);
  });

  test("closed range from the ip() helper", () => {
    const r = Ipv4Interval.closed(
      Ipv4Interval.ip("192.168.0.0"),
      Ipv4Interval.ip("192.168.255.255"),
    );
    expect(r.toString()).toBe("[192.168.0.0,192.168.255.255]");
    expect(r.length()).toBe(65536);
  });

  test("adjacent /24 blocks merge", () => {
    const a = Ipv4Interval.cidr("10.0.0.0/24"); // 10.0.0.0 – 10.0.0.255
    const b = Ipv4Interval.cidr("10.0.1.0/24"); // 10.0.1.0 – 10.0.1.255
    expect(a.union(b)?.length()).toBe(512);
    expect(a.union(b)?.toString()).toBe("[10.0.0.0,10.0.1.255]");
  });

  test("the whole space (closed at 255.255.255.255) — no successor overflow", () => {
    const all = Ipv4Interval.closed(Ipv4Interval.ip("0.0.0.0"), Ipv4Interval.ip("255.255.255.255"));
    expect(all.length()).toBe(2 ** 32);
    expect(all.toString()).toBe("[0.0.0.0,255.255.255.255]");
  });

  test("midpoint address", () => {
    expect(Ipv4Interval.cidr("10.0.0.0/24").middle()).toBe(Ipv4Interval.ip("10.0.0.128"));
  });

  test("parse round-trips; instanceof", () => {
    expect(Ipv4Interval.parse("[192.168.0.0,192.168.0.255]").toString()).toBe(
      "[192.168.0.0,192.168.0.255]",
    );
    expect(Ipv4Interval.cidr("10.0.0.0/8")).toBeInstanceOf(Interval);
  });
});

describe("Ipv6Interval (discrete)", () => {
  test("CIDR contains + canonical compressed form", () => {
    const block = Ipv6Interval.cidr("2001:db8::/32");
    expect(block.contains(Ipv6Interval.ip("2001:db8::1"))).toBe(true);
    expect(block.contains(Ipv6Interval.ip("2001:db9::1"))).toBe(false);
    expect(block.toString().startsWith("[2001:db8::,")).toBe(true);
  });

  test("ip() round-trips the canonical (compressed) form", () => {
    expect(Ipv6Interval.closed(Ipv6Interval.ip("::1"), Ipv6Interval.ip("::ff")).toString()).toBe(
      "[::1,::ff]",
    );
  });
});
