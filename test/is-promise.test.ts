import { describe, expect, test } from "vitest";

import { isPromise } from "../src/is-promise";

describe("isPromise", () => {
  test("native Promise", () => {
    expect(isPromise(Promise.resolve(1))).toBe(true);
  });

  test("async function return", () => {
    const fn = async () => 1;
    expect(isPromise(fn())).toBe(true);
  });

  test("Promise.reject", () => {
    const p = Promise.reject(new Error("test"));
    p.catch(() => {}); // prevent unhandled rejection
    expect(isPromise(p)).toBe(true);
  });

  test("thenable object (duck-typed)", () => {
    // eslint-disable-next-line unicorn/no-thenable
    const thenable = { then: (_resolve: (v: number) => void) => {} } as unknown as number;
    expect(isPromise(thenable)).toBe(true);
  });

  test("primitive string", () => {
    expect(isPromise("hello")).toBe(false);
  });

  test("primitive number", () => {
    expect(isPromise(42)).toBe(false);
  });

  test("null", () => {
    expect(isPromise(null as unknown as string)).toBe(false);
  });

  test("undefined", () => {
    expect(isPromise(undefined as unknown as string)).toBe(false);
  });

  test("plain object without then", () => {
    expect(isPromise({} as unknown as string)).toBe(false);
  });

  test("object with non-function then", () => {
    // eslint-disable-next-line unicorn/no-thenable
    expect(isPromise({ then: 42 } as unknown as string)).toBe(false);
  });

  test("array", () => {
    expect(isPromise([] as unknown as string)).toBe(false);
  });

  test("function (not thenable)", () => {
    expect(isPromise((() => {}) as unknown as string)).toBe(false);
  });
});
