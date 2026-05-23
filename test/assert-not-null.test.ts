import { describe, expect, test } from "vitest";

import { assertNotNull } from "../src/assert-not-null";
import { AssertError } from "../src/errors";

describe("assertNotNull", () => {
  describe("returns non-nullish values", () => {
    test("number", () => expect(assertNotNull(42)).toBe(42));
    test("string", () => expect(assertNotNull("hello")).toBe("hello"));
    test("false", () => expect(assertNotNull(false)).toBe(false));
    test("0", () => expect(assertNotNull(0)).toBe(0));
    test("empty string", () => expect(assertNotNull("")).toBe(""));
    test("NaN", () => expect(assertNotNull(Number.NaN)).toBeNaN());
    test("Infinity", () =>
      expect(assertNotNull(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY));
    test("-Infinity", () =>
      expect(assertNotNull(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY));
    test("-0", () => expect(Object.is(assertNotNull(-0), -0)).toBe(true));
    test("BigInt zero", () => expect(assertNotNull(0n)).toBe(0n));
    test("Symbol", () => {
      const sym = Symbol("test");
      expect(assertNotNull(sym)).toBe(sym);
    });
    test("empty object", () => {
      const obj = {};
      expect(assertNotNull(obj)).toBe(obj);
    });
    test("empty array", () => {
      const arr: never[] = [];
      expect(assertNotNull(arr)).toBe(arr);
    });
    test("invalid Date", () => {
      const d = new Date("invalid");
      expect(assertNotNull(d)).toBe(d);
    });
    test("Object.create(null)", () => {
      const obj = Object.create(null) as object;
      expect(assertNotNull(obj)).toBe(obj);
    });
    test("frozen Object.create(null)", () => {
      const obj = Object.freeze(Object.create(null)) as object;
      expect(assertNotNull(obj)).toBe(obj);
    });
    // eslint-disable-next-line unicorn/new-for-builtins
    test("new Number(42)", () => expect(assertNotNull(new Number(42))).toBeInstanceOf(Number));
    // eslint-disable-next-line unicorn/new-for-builtins
    test("new Number(null) (is Number(0))", () =>
      expect(assertNotNull(new Number(null as unknown as number)).valueOf()).toBe(0));
    // eslint-disable-next-line unicorn/new-for-builtins
    test("new String('')", () => expect(assertNotNull(new String("")).valueOf()).toBe(""));
  });

  describe("throws on nullish values", () => {
    test("null", () => expect(() => assertNotNull(null)).toThrow(AssertError));
    test("undefined", () => expect(() => assertNotNull(undefined)).toThrow(AssertError));
    test("void 0", () => expect(() => assertNotNull(void 0)).toThrow(AssertError));
    test("default message", () =>
      expect(() => assertNotNull(null)).toThrow("unexpected null or undefined"));
    test("custom message", () => expect(() => assertNotNull(null, "custom")).toThrow("custom"));
  });
});
