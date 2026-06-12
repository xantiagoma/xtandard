import { describe, expect, expectTypeOf, test } from "vitest";
import { isPromise } from "../src/is-promise.ts";
import { tryCatch, tryCatchSync } from "../src/try-catch.ts";

describe("tryCatch", () => {
  test("returns [data, null] on success", async () => {
    const [data, error] = await tryCatch(Promise.resolve(42));
    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  test("returns [null, error] on rejection", async () => {
    const [data, error] = await tryCatch(Promise.reject(new Error("boom")));
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toBe("boom");
  });

  test("accepts a function returning a promise", async () => {
    const [data, error] = await tryCatch(async () => "hello");
    expect(data).toBe("hello");
    expect(error).toBeNull();
  });

  test("catches sync throw inside function", async () => {
    const [data, error] = await tryCatch(() => {
      throw new Error("sync boom");
    });
    expect(data).toBeNull();
    expect(error!.message).toBe("sync boom");
  });

  test("catches async rejection inside function", async () => {
    const [data, error] = await tryCatch(async () => {
      throw new Error("async boom");
    });
    expect(data).toBeNull();
    expect(error!.message).toBe("async boom");
  });

  test("works with non-Error rejection", async () => {
    const [data, error] = await tryCatch<number, string>(Promise.reject("string error"));
    expect(data).toBeNull();
    expect(error).toBe("string error");
  });
});

describe("tryCatch — sync functions (adaptive)", () => {
  test("returns the tuple synchronously, no await needed", () => {
    const result = tryCatch((): number => 42);
    expectTypeOf(result).toEqualTypeOf<[number, null] | [null, Error]>();
    expect(isPromise(result)).toBe(false);
    expect(result).toEqual([42, null]);
  });

  test("`any`-returning functions stay destructurable (JSON.parse)", () => {
    const [data, error] = tryCatch(() => JSON.parse('{"ok":true}'));
    expect(data).toEqual({ ok: true });
    expect(error).toBeNull();
  });

  test("catches sync throws synchronously", () => {
    const result = tryCatch((): number => {
      throw new Error("boom");
    });
    expect(isPromise(result)).toBe(false);
    const [data, error] = result;
    expect(data).toBeNull();
    expect(error!.message).toBe("boom");
  });

  test("async functions still produce a Promise", () => {
    const result = tryCatch(async () => "hello");
    expectTypeOf(result).toEqualTypeOf<Promise<[string, null] | [null, Error]>>();
    expect(isPromise(result)).toBe(true);
  });

  test("promise inputs still produce a Promise", () => {
    expect(isPromise(tryCatch(Promise.resolve(1)))).toBe(true);
  });
});

describe("tryCatchSync", () => {
  test("returns [data, null] on success", () => {
    const [data, error] = tryCatchSync(() => JSON.parse('{"ok":true}'));
    expect(data).toEqual({ ok: true });
    expect(error).toBeNull();
  });

  test("returns [null, error] on throw", () => {
    const [data, error] = tryCatchSync(() => JSON.parse("not json"));
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(SyntaxError);
  });

  test("returns primitive values", () => {
    const [data, error] = tryCatchSync(() => 42);
    expect(data).toBe(42);
    expect(error).toBeNull();
  });

  test("works with non-Error throw", () => {
    const [data, error] = tryCatchSync<number, string>(() => {
      throw "string error";
    });
    expect(data).toBeNull();
    expect(error).toBe("string error");
  });
});
