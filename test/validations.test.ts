import { describe, expect, test } from "vitest";

import { parseTimeZone } from "../src/valibot-utils";

describe("parseTimeZone", () => {
  test("valid timezone", () => {
    const result: string = parseTimeZone("America/New_York");
    expect(result).toBe("America/New_York");
  });

  test("UTC", () => {
    const result: string = parseTimeZone("UTC");
    expect(result).toBe("UTC");
  });

  test("invalid timezone throws", () => {
    expect(() => parseTimeZone("Not/A/Zone")).toThrow();
  });

  test("non-string throws", () => {
    expect(() => parseTimeZone(42)).toThrow();
  });
});
