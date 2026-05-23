import { describe, expect, test } from "vitest";

import { cast } from "../src/cast";

describe("cast", () => {
  test("returns the same value", () => {
    const value = { foo: "bar" };
    expect(cast<{ foo: string }>(value)).toBe(value);
  });

  test("works with primitives", () => {
    expect(cast<number>(42)).toBe(42);
  });
});
