import { describe, expect, test } from "vitest";

import { assertNotNull } from "../src/assert-not-null";
import { AssertError } from "../src/errors";

describe("AssertError", () => {
  test("is an Error", () => {
    expect(new AssertError()).toBeInstanceOf(Error);
  });

  test("has default message", () => {
    expect(new AssertError().message).toBe("unexpected null or undefined");
  });

  test("default message matches assertNotNull's default", () => {
    let thrown: unknown;
    try {
      assertNotNull(null);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AssertError);
    expect((thrown as AssertError).message).toBe(new AssertError().message);
  });

  test("accepts custom message", () => {
    expect(new AssertError("custom").message).toBe("custom");
  });

  test("has correct name", () => {
    expect(new AssertError().name).toBe("AssertError");
  });
});
