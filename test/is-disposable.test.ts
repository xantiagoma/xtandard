import { describe, expect, test } from "vitest";

import { defer, deferSync } from "../src/defer";
import { isAsyncDisposable, isDisposable, isSyncDisposable } from "../src/is-disposable";
import { makeDisposable } from "../src/make-disposable";

describe("isAsyncDisposable", () => {
  test("object with Symbol.asyncDispose", () => {
    expect(isAsyncDisposable({ [Symbol.asyncDispose]: async () => {} })).toBe(true);
  });

  test("makeDisposable result", async () => {
    const d = await makeDisposable({});
    expect(isAsyncDisposable(d)).toBe(true);
  });

  test("defer result", () => {
    expect(isAsyncDisposable(defer(() => {}))).toBe(true);
  });

  test("plain object", () => expect(isAsyncDisposable({})).toBe(false));
  test("null", () => expect(isAsyncDisposable(null)).toBe(false));
  test("undefined", () => expect(isAsyncDisposable(undefined)).toBe(false));
  test("non-function Symbol.asyncDispose", () => {
    expect(isAsyncDisposable({ [Symbol.asyncDispose]: 42 })).toBe(false);
  });
});

describe("isSyncDisposable", () => {
  test("object with Symbol.dispose", () => {
    expect(isSyncDisposable({ [Symbol.dispose]: () => {} })).toBe(true);
  });

  test("deferSync result", () => {
    expect(isSyncDisposable(deferSync(() => {}))).toBe(true);
  });

  test("plain object", () => expect(isSyncDisposable({})).toBe(false));
  test("async disposable is not sync", async () => {
    const d = await makeDisposable({});
    expect(isSyncDisposable(d)).toBe(false);
  });
});

describe("isDisposable", () => {
  test("async disposable", () => {
    expect(isDisposable({ [Symbol.asyncDispose]: async () => {} })).toBe(true);
  });

  test("sync disposable", () => {
    expect(isDisposable({ [Symbol.dispose]: () => {} })).toBe(true);
  });

  test("both", () => {
    expect(
      isDisposable({
        [Symbol.asyncDispose]: async () => {},
        [Symbol.dispose]: () => {},
      }),
    ).toBe(true);
  });

  test("plain object", () => expect(isDisposable({})).toBe(false));
  test("null", () => expect(isDisposable(null)).toBe(false));
  test("string", () => expect(isDisposable("hi")).toBe(false));
});
