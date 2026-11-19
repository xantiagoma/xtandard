import { describe, test, expect, vi } from "vitest";
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

describe("useStream without a queryKey", () => {
  test("streams from different factories don't share a cache entry", async () => {
    async function* letters() {
      yield "a";
      yield "b";
    }
    async function* numbers() {
      yield 1;
      yield 2;
    }

    const { result } = await renderHook(
      () => ({
        letters: useStream({ source: letters }),
        numbers: useStream({ source: numbers }),
      }),
      { wrapper: createWrapper() },
    );

    await vi.waitFor(() => {
      expect(result.current.letters.isSuccess).toBe(true);
      expect(result.current.numbers.isSuccess).toBe(true);
    });
    expect(result.current.letters.items).toEqual(["a", "b"]);
    expect(result.current.numbers.items).toEqual([1, 2]);
  });

  test("an inline factory runs once: the default key is stable across renders", async () => {
    const factory = vi.fn(async function* () {
      yield 1;
      yield 2;
      return "done";
    });

    const { result, rerender } = await renderHook(() => useStream({ source: () => factory() }), {
      wrapper: createWrapper(),
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    await rerender();
    await rerender();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([1, 2]);
    expect(result.current.returnValue).toBe("done");
  });
});

describe("StreamRenderer forwards enabled and retry", () => {
  test("enabled={false} does not start the stream", async () => {
    const factory = vi.fn(async function* () {
      yield "x";
    });

    const screen = await render(
      <QueryClientProvider client={new QueryClient()}>
        <StreamRenderer<string>
          source={factory}
          queryKey={["renderer-disabled"]}
          enabled={false}
          loading={<span data-testid="state">idle</span>}
          success={({ items }) => <span data-testid="state">{items.join(",")}</span>}
        />
      </QueryClientProvider>,
    );

    await expect.element(screen.getByTestId("state")).toHaveTextContent("idle");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(factory).not.toHaveBeenCalled();
  });

  test("retry={1} retries a failed stream once", async () => {
    let calls = 0;
    async function* flaky() {
      calls += 1;
      if (calls === 1) throw new Error("first attempt fails");
      yield "ok";
    }

    const screen = await render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })}
      >
        <StreamRenderer<string>
          source={flaky}
          queryKey={["renderer-retry"]}
          retry={1}
          error={({ error }) => <span data-testid="state">{error.message}</span>}
          success={({ items }) => <span data-testid="state">{items.join(",")}</span>}
        />
      </QueryClientProvider>,
    );

    await expect.element(screen.getByTestId("state")).toHaveTextContent("ok");
    expect(calls).toBe(2);
  });
});
