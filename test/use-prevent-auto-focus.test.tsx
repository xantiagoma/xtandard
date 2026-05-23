/**
 * @vitest-environment jsdom
 */
import { describe, test, expect } from "vitest";
import React from "react";
import { render, renderHook } from "vitest-browser-react";
import { usePreventAutoFocus } from "../src/use-prevent-auto-focus.ts";

describe("usePreventAutoFocus", () => {
  test("returns ref, onOpenAutoFocus, and tabIndex", async () => {
    const { result } = await renderHook(() => usePreventAutoFocus());

    expect(result.current.ref).toBeDefined();
    expect(result.current.onOpenAutoFocus).toBeTypeOf("function");
    expect(result.current.tabIndex).toBe(-1);
  });

  test("onOpenAutoFocus prevents default and focuses element", async () => {
    function TestComponent() {
      const { ref, onOpenAutoFocus, tabIndex } = usePreventAutoFocus();
      return (
        <div
          ref={ref}
          tabIndex={tabIndex}
          data-testid="target"
          onClick={() => {
            const event = new Event("focus", { cancelable: true });
            onOpenAutoFocus(event);
          }}
        >
          focusable
        </div>
      );
    }

    const screen = await render(<TestComponent />);
    await expect.element(screen.getByTestId("target")).toBeVisible();
  });

  test("works with custom element type", async () => {
    const { result } = await renderHook(() => usePreventAutoFocus<HTMLButtonElement>());
    expect(result.current.ref.current).toBeNull();
    expect(result.current.tabIndex).toBe(-1);
  });
});
