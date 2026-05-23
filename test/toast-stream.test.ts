import { describe, test, expect, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(
    vi.fn(() => "toast-id"),
    {
      loading: vi.fn(() => "toast-id"),
      success: vi.fn(() => "toast-id"),
      error: vi.fn(() => "toast-id"),
      dismiss: vi.fn(),
    },
  ),
}));

import { toastStream } from "../src/toast-stream.ts";

describe("toastStream", () => {
  test("is a function", () => {
    expect(typeof toastStream).toBe("function");
  });

  test("handles async generator", async () => {
    async function* gen() {
      yield 1;
      yield 2;
      yield 3;
    }

    const result = await toastStream(gen(), {
      loading: "Loading...",
      success: (data) => `Done: ${data.items.length} items`,
      error: "Failed",
    });

    expect(result.items).toEqual([1, 2, 3]);
  });

  test("handles array as iterable", async () => {
    const result = await toastStream([1, 2, 3], {
      loading: "Loading...",
      success: "Done",
      error: "Failed",
    });

    expect(result.items).toEqual([1, 2, 3]);
  });

  test("handles async generator that throws", async () => {
    async function* gen() {
      yield 1;
      throw new Error("boom");
    }

    await expect(
      toastStream(gen(), {
        loading: "Loading...",
        success: "Done",
        error: "Failed",
      }),
    ).rejects.toThrow("boom");
  });
});
