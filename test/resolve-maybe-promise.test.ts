import { describe, expect, test } from "vitest";

import { chainMaybePromise, resolveMaybePromise } from "../src/resolve-maybe-promise";
import { isPromise } from "../src/is-promise";

describe("resolveMaybePromise", () => {
  test("resolves a sync value", async () => {
    expect(await resolveMaybePromise(42)).toBe(42);
  });

  test("resolves a sync string", async () => {
    expect(await resolveMaybePromise("hello")).toBe("hello");
  });

  test("resolves a sync null", async () => {
    expect(await resolveMaybePromise(null)).toBeNull();
  });

  test("resolves a sync undefined", async () => {
    expect(await resolveMaybePromise(undefined)).toBeUndefined();
  });

  test("resolves a Promise", async () => {
    expect(await resolveMaybePromise(Promise.resolve(42))).toBe(42);
  });

  test("resolves a Promise with string", async () => {
    expect(await resolveMaybePromise(Promise.resolve("hello"))).toBe("hello");
  });

  test("rejects when Promise rejects", async () => {
    expect(resolveMaybePromise(Promise.reject(new Error("fail")))).rejects.toThrow("fail");
  });

  test("returns a Promise regardless of input", () => {
    const result = resolveMaybePromise(42);
    expect(result).toBeInstanceOf(Promise);
  });
});

describe("chainMaybePromise", () => {
  test("stays synchronous for plain values", () => {
    const result = chainMaybePromise(1, (n) => n + 1);
    expect(isPromise(result)).toBe(false);
    expect(result).toBe(2);
  });

  test("chains Promises", async () => {
    const result = chainMaybePromise(Promise.resolve(1), (n) => n + 1);
    expect(isPromise(result)).toBe(true);
    expect(await result).toBe(2);
  });

  test("flattens a Promise-returning fn over a sync value", async () => {
    const result = chainMaybePromise(1, (n) => Promise.resolve(n + 1));
    expect(await result).toBe(2);
  });
});
