import { describe, expect, test } from "vitest";

import { Completer } from "../src/completer";

describe("Completer", () => {
  test("resolve returns value via promise", async () => {
    const c = new Completer<number>();
    c.resolve(42);
    expect(await c.promise()).toBe(42);
  });

  test("reject throws via promise", async () => {
    const c = new Completer<number, Error>();
    c.reject(new Error("fail"));
    expect(c.promise()).rejects.toThrow("fail");
  });

  test("reset allows reuse", async () => {
    const c = new Completer<number>();
    c.resolve(1);
    expect(await c.promise()).toBe(1);

    c.reset();
    c.resolve(2);
    expect(await c.promise()).toBe(2);
  });

  test("promise resolves asynchronously", async () => {
    const c = new Completer<string>();
    setTimeout(() => c.resolve("done"), 5);
    expect(await c.promise()).toBe("done");
  });

  test("resolve accepts a Promise (MaybePromise)", async () => {
    const c = new Completer<number>();
    c.resolve(Promise.resolve(99));
    expect(await c.promise()).toBe(99);
  });
});
