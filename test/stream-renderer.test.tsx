import { describe, test, expect } from "vitest";
import React from "react";
import { render, renderHook } from "vitest-browser-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStream, StreamRenderer } from "../src/stream-renderer.tsx";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useStream", () => {
  test("is exported as a function", () => {
    expect(typeof useStream).toBe("function");
  });

  test("returns initial state", async () => {
    async function* gen() {
      yield "a";
    }

    const { result } = await renderHook(
      () =>
        useStream<string>({
          queryKey: ["test-init"],
          source: gen,
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.items).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  test("accepts array source", async () => {
    const { result } = await renderHook(
      () =>
        useStream<number>({
          queryKey: ["test-array-src"],
          source: [1, 2, 3],
        }),
      { wrapper: createWrapper() },
    );

    expect(Array.isArray(result.current.items)).toBe(true);
  });
});

describe("StreamRenderer", () => {
  test("is exported as a function", () => {
    expect(typeof StreamRenderer).toBe("function");
  });

  test("renders with source", async () => {
    async function* gen() {
      yield "hello";
    }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <StreamRenderer<string> queryKey={["test-render"]} source={gen}>
          {({ items }) => <div data-testid="result">{items.join(",")}</div>}
        </StreamRenderer>
      </QueryClientProvider>,
    );

    expect(screen).toBeDefined();
  });
});
