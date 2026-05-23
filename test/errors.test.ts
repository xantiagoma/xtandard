import { describe, expect, test } from "vitest";

import { AssertError } from "../src/errors";

describe("AssertError", () => {
  test("is an Error", () => {
    expect(new AssertError()).toBeInstanceOf(Error);
  });

  test("has default message", () => {
    expect(new AssertError().message).toBe("The value is null or undefined");
  });

  test("accepts custom message", () => {
    expect(new AssertError("custom").message).toBe("custom");
  });

  test("has correct name", () => {
    expect(new AssertError().name).toBe("AssertError");
  });
});
