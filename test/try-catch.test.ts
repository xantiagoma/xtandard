import { describe, expect, test } from "vitest";
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
