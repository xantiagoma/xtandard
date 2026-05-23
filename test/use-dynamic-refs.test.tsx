import { describe, test, expect } from "vitest";
import React from "react";
import { render, renderHook } from "vitest-browser-react";
import { useDynamicRefs } from "../src/use-dynamic-refs.ts";

describe("useDynamicRefs", () => {
  test("returns a getter function", async () => {
    const { result } = await renderHook(() => useDynamicRefs<HTMLDivElement>());
    expect(typeof result.current).toBe("function");
  });

  test("returns undefined when called without key", async () => {
    const { result } = await renderHook(() => useDynamicRefs<HTMLDivElement>());
    expect(result.current()).toBeUndefined();
  });

  test("returns a ref for a given key", async () => {
    const { result } = await renderHook(() => useDynamicRefs<HTMLDivElement>());
    const ref = result.current("item-1");
    expect(ref).toBeDefined();
    expect(ref).toHaveProperty("current");
  });

  test("returns the same ref for the same key", async () => {
    const { result } = await renderHook(() => useDynamicRefs<HTMLDivElement>());
    const ref1 = result.current("key-a");
    const ref2 = result.current("key-a");
    expect(ref1).toBe(ref2);
  });

  test("returns different refs for different keys", async () => {
    const { result } = await renderHook(() => useDynamicRefs<HTMLDivElement>());
    const ref1 = result.current("key-a");
    const ref2 = result.current("key-b");
    expect(ref1).not.toBe(ref2);
  });

  test("refs attach to DOM elements", async () => {
    function TestList() {
      const getRef = useDynamicRefs<HTMLButtonElement>();
      return (
        <div>
          {["a", "b", "c"].map((id) => (
            <button key={id} ref={getRef(id)} data-testid={`btn-${id}`}>
              {id}
            </button>
          ))}
        </div>
      );
    }

    const screen = await render(<TestList />);
    await expect.element(screen.getByTestId("btn-a")).toBeVisible();
    await expect.element(screen.getByTestId("btn-b")).toBeVisible();
    await expect.element(screen.getByTestId("btn-c")).toBeVisible();
  });
});
