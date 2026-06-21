import { describe, expect, test } from "vitest";

import {
  combineResolvedOptions,
  LIBRARY_DEFAULTS,
  resolveOptions,
} from "../src/tanstack/core/options.ts";
import { combineRateLimits, debounce, throttle } from "../src/tanstack/core/rate-limit.ts";

describe("resolveOptions precedence", () => {
  test("library defaults when nothing is set", () => {
    expect(resolveOptions({})).toEqual(LIBRARY_DEFAULTS);
  });

  test("call > parser > hook > adapter", () => {
    const resolved = resolveOptions({
      callOptions: { history: "push" },
      parserOptions: { history: "replace", shallow: false },
      hookOptions: { shallow: true, scroll: true },
      adapterDefaults: { scroll: false, clearOnDefault: false },
    });
    expect(resolved.history).toBe("push"); // call wins
    expect(resolved.shallow).toBe(false); // parser wins over hook
    expect(resolved.scroll).toBe(true); // hook wins over adapter
    expect(resolved.clearOnDefault).toBe(false); // adapter wins over library
  });
});

describe("combineRateLimits", () => {
  test("longest delay wins", () => {
    expect(combineRateLimits(throttle(50), throttle(120))).toEqual(throttle(120));
  });
  test("debounce dominates throttle", () => {
    expect(combineRateLimits(throttle(50), debounce(10))).toEqual(debounce(50));
  });
  test("Infinity sticks", () => {
    expect(combineRateLimits(throttle(Infinity), throttle(50)).timeMs).toBe(Infinity);
  });
});

describe("combineResolvedOptions", () => {
  test("loudest update wins", () => {
    const a = resolveOptions({ callOptions: { history: "replace", shallow: true } });
    const b = resolveOptions({ callOptions: { history: "push", shallow: false, scroll: true } });
    const combined = combineResolvedOptions(a, b);
    expect(combined.history).toBe("push");
    expect(combined.shallow).toBe(false);
    expect(combined.scroll).toBe(true);
  });
});
