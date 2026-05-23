import { describe, expect, test } from "vitest";

import { valueOrThrow } from "../src/error";

describe("valueOrThrow", () => {
  test("returns value when throwOnInvalid is false", () => {
    expect(valueOrThrow({ value: null, error: "err", throwOnInvalid: false })).toBeNull();
  });

  test("returns value when throwOnInvalid is default", () => {
    expect(valueOrThrow({ value: "ok", error: "err" })).toBe("ok");
  });

  test("throws Error instance when throwOnInvalid", () => {
    const err = new Error("boom");
    expect(() => valueOrThrow({ value: null, error: err, throwOnInvalid: true })).toThrow(err);
  });

  test("throws string as Error when throwOnInvalid", () => {
    expect(() => valueOrThrow({ value: null, error: "boom", throwOnInvalid: true })).toThrow(
      "boom",
    );
  });
});
