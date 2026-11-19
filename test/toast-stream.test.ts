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

import { toastStream, toastStreamAsync } from "../src/entry-sonner.ts";

describe("toastStream", () => {
  test("is a function", () => {
    expect(typeof toastStream).toBe("function");
  });

  test("exports toastStreamAsync from the sonner entry", () => {
    expect(typeof toastStreamAsync).toBe("function");
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

describe("toastStreamAsync", () => {
  test("returns the toast id and unwrap() immediately, for a numeric id (Sonner's default)", async () => {
    const { toast } = await import("sonner");
    vi.mocked(toast.loading).mockReturnValueOnce(7);

    const handle = toastStreamAsync([1, 2, 3], { loading: "Loading..." });

    expect(handle.id).toBe(7);
    await expect(handle.unwrap()).resolves.toEqual({ items: [1, 2, 3], returnValue: undefined });
    expect(toast.success).toHaveBeenLastCalledWith("Complete! 3 items", { id: 7 });
  });

  test("works for a string id and carries the generator's return value", async () => {
    async function* gen() {
      yield "a";
      return 42;
    }

    const handle = toastStreamAsync(gen, { loading: "Loading..." });

    expect(handle.id).toBe("toast-id");
    const { items, returnValue } = await handle.unwrap();
    expect(items).toEqual(["a"]);
    expect(returnValue).toBe(42);
  });

  test("unwrap() rejects with the stream error after showing the error toast", async () => {
    const { toast } = await import("sonner");
    async function* gen() {
      yield 1;
      throw new Error("boom");
    }

    const handle = toastStreamAsync(gen(), { error: "Failed" });

    await expect(handle.unwrap()).rejects.toThrow("boom");
    expect(toast.error).toHaveBeenLastCalledWith("Failed", { id: "toast-id" });
  });

  test("a failed stream that is never unwrapped is not an unhandled rejection", async () => {
    const { toast } = await import("sonner");
    async function* gen() {
      yield 1;
      throw new Error("ignored");
    }

    toastStreamAsync(gen(), { error: "Not unwrapped" });
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenLastCalledWith("Not unwrapped", { id: "toast-id" }),
    );
  });
});
