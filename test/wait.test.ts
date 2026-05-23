import { describe, expect, test } from "vitest";

import { wait } from "../src/wait";

describe("wait", () => {
  test("resolves after delay", async () => {
    const start = performance.now();
    await wait(50);
    expect(performance.now() - start).toBeGreaterThanOrEqual(40);
  });

  test("resolves with undefined by default", async () => {
    expect(await wait(1)).toBeUndefined();
  });

  test("resolves with provided value", async () => {
    expect(await wait(1, "hello")).toBe("hello");
  });

  test("preserves value type", async () => {
    const result = await wait(1, { ok: true as const });
    expect(result).toEqual({ ok: true });
  });
});
