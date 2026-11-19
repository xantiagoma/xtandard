/**
 * IP-address intervals — the generic `Interval<T>` engine over IPv4/IPv6 addresses
 * (via [ipaddr.js](https://github.com/whitequark/ipaddr.js)). DISCRETE — the
 * epsilon is one address, so a CIDR block is a clean range, adjacent ranges merge,
 * and `length()` counts addresses. Use it for firewall rules, allowlists, CIDR
 * math, geo-IP buckets. ipaddr.js is a **peer dependency**.
 *
 * Addresses are modeled as their integer value (`bigint`) so arithmetic never
 * overflows the address space; `toString()`/`parse()` render the canonical dotted
 * (v4) / compressed (v6) form. Build from strings with the `.ip(addr)` helper, or
 * from CIDR with `.cidr("10.0.0.0/8")`.
 */

import ipaddr from "ipaddr.js";

import { defineIntervalType, type Interval, type IntervalDomain } from "./interval.ts";

const bytesToBig = (bytes: readonly number[]): bigint =>
  bytes.reduce((acc, byte) => acc * 256n + BigInt(byte), 0n);

function bigToBytes(value: bigint, length: number): number[] {
  const bytes = Array.from({ length }, () => 0);
  let rest = value;
  for (let i = length - 1; i >= 0; i -= 1) {
    bytes[i] = Number(rest % 256n);
    rest /= 256n;
  }

  return bytes;
}

interface IpParser {
  parse(addr: string): { toByteArray(): number[] };
  parseCIDR(addr: string): [{ toByteArray(): number[] }, number];
}

function ipDomain(
  name: "ipv4" | "ipv6",
  byteLength: 4 | 16,
  parser: IpParser,
): IntervalDomain<bigint> {
  const max = (1n << BigInt(byteLength * 8)) - 1n;

  return {
    name,
    compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
    isValid: (value) => value >= 0n && value <= max,
    next: (value) => value + 1n,
    prev: (value) => value - 1n,
    measure: (lower, upper) => Number(upper - lower),
    add: (value, delta) => value + BigInt(Math.trunc(delta)),
    format: (value) => ipaddr.fromByteArray(bigToBytes(value, byteLength)).toString(),
    parse: (text) => bytesToBig(parser.parse(text).toByteArray()),
  };
}

/** `addr → bigint` for one IP family, used by the `.ip()` / `.cidr()` helpers. */
function ipExtras(
  byteLength: 4 | 16,
  parser: IpParser,
  build: (lo: bigint, hi: bigint) => Interval<bigint>,
) {
  const ip = (addr: string): bigint => bytesToBig(parser.parse(addr).toByteArray());

  return {
    /** Parse a single address string to its comparable `bigint` value. */
    ip,
    /** The interval covering a CIDR block, e.g. `"192.168.0.0/16"` → `[network, broadcast]`. */
    cidr: (block: string): Interval<bigint> => {
      const [addr, prefix] = parser.parseCIDR(block);
      const base = bytesToBig(addr.toByteArray());
      const hostMask = (1n << BigInt(byteLength * 8 - prefix)) - 1n;

      return build(base & ~hostMask, base | hostMask);
    },
  };
}

/**
 * The IPv4 interval class without the `.ip()`/`.cidr()` helpers. Internal: it is
 * not exported and shows up in the API only as the instance type behind
 * {@link Ipv4Interval}. Use `Ipv4Interval`, which is this same class plus the helpers.
 *
 * @example
 * ```ts
 * import { Ipv4Interval } from "@xtandard/lib/ip";
 *
 * const r: Ipv4Interval = Ipv4Interval.parse("[10.0.0.0,10.0.0.255]");
 * r.length(); // 256
 * ```
 */
const Ipv4Base = defineIntervalType(ipDomain("ipv4", 4, ipaddr.IPv4));
/**
 * The IPv6 interval class without the `.ip()`/`.cidr()` helpers. Internal: it is
 * not exported and shows up in the API only as the instance type behind
 * {@link Ipv6Interval}. Use `Ipv6Interval`, which is this same class plus the helpers.
 *
 * @example
 * ```ts
 * import { Ipv6Interval } from "@xtandard/lib/ip";
 *
 * const r: Ipv6Interval = Ipv6Interval.cidr("2001:db8::/120");
 * r.length(); // 256
 * ```
 */
const Ipv6Base = defineIntervalType(ipDomain("ipv6", 16, ipaddr.IPv6));

/**
 * Interval over IPv4 addresses (discrete, ε = one address). Values are the
 * address as a `bigint`: convert with `.ip("10.0.0.1")`, or build a whole
 * block with `.cidr("10.0.0.0/8")`. `toString()`/`parse()` use dotted form.
 *
 * @example
 * ```ts
 * import { Ipv4Interval } from "@xtandard/lib/ip";
 *
 * const lan = Ipv4Interval.cidr("192.168.0.0/16");
 * lan.contains(Ipv4Interval.ip("192.168.1.50")); // true
 * lan.length(); // 65536
 * lan.toString(); // "[192.168.0.0,192.168.255.255]"
 * Ipv4Interval.cidr("10.0.0.0/24").difference(Ipv4Interval.cidr("10.0.0.64/26")).map(String);
 * // ["[10.0.0.0,10.0.0.63]", "[10.0.0.128,10.0.0.255]"]
 * ```
 */
export const Ipv4Interval = Object.assign(
  Ipv4Base,
  ipExtras(4, ipaddr.IPv4, (lo, hi) => Ipv4Base.closed(lo, hi)),
);
/** Instance type of {@link Ipv4Interval}. */
export type Ipv4Interval = InstanceType<typeof Ipv4Base>;

/**
 * Interval over IPv6 addresses (discrete, ε = one address). Build with `.ip()` /
 * `.cidr()`; `toString()`/`parse()` use the compressed form. `length()` is a
 * `number`, so it loses precision for blocks larger than 2^53 addresses.
 *
 * @example
 * ```ts
 * import { Ipv6Interval } from "@xtandard/lib/ip";
 *
 * const net = Ipv6Interval.cidr("2001:db8::/32");
 * net.contains(Ipv6Interval.ip("2001:db8::1")); // true
 * net.encloses(Ipv6Interval.cidr("2001:db8:abcd::/48")); // true
 * net.toString(); // "[2001:db8::,2001:db8:ffff:ffff:ffff:ffff:ffff:ffff]"
 * ```
 */
export const Ipv6Interval = Object.assign(
  Ipv6Base,
  ipExtras(16, ipaddr.IPv6, (lo, hi) => Ipv6Base.closed(lo, hi)),
);
/** Instance type of {@link Ipv6Interval}. */
export type Ipv6Interval = InstanceType<typeof Ipv6Base>;
