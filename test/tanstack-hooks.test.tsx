import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, renderHook } from "vitest-browser-react";

import {
  QueryStateTestingAdapter,
  type UrlUpdateEvent,
} from "../src/tanstack/adapters/testing.tsx";
import {
  parseAsInteger,
  parseAsNativeArrayOf,
  parseAsString,
} from "../src/tanstack/core/built-in-parsers.ts";
import { useQueryState } from "../src/tanstack/react/use-query-state.ts";
import { useQueryStates } from "../src/tanstack/react/use-query-states.ts";

function wrapper(searchParams: string, updates?: UrlUpdateEvent[]) {
  return ({ children }: { children: ReactNode }) => (
    <QueryStateTestingAdapter
      searchParams={searchParams}
      onUrlUpdate={updates ? (event) => updates.push(event) : undefined}
    >
      {children}
    </QueryStateTestingAdapter>
  );
}

describe("useQueryState", () => {
  it("reads a present key", async () => {
    const { result } = await renderHook(() => useQueryState("name"), {
      wrapper: wrapper("?name=foo"),
    });
    expect(result.current[0]).toBe("foo");
  });

  it("missing key without parser → null", async () => {
    const { result } = await renderHook(() => useQueryState("name"), {
      wrapper: wrapper(""),
    });
    expect(result.current[0]).toBeNull();
  });

  it("typed parser with default", async () => {
    const { result } = await renderHook(
      () => useQueryState("page", parseAsInteger.withDefault(1)),
      {
        wrapper: wrapper("?page=4"),
      },
    );
    expect(result.current[0]).toBe(4);
  });

  it("updates state synchronously on set", async () => {
    const { result } = await renderHook(
      () => useQueryState("name", parseAsString.withDefault("")),
      { wrapper: wrapper("") },
    );
    await result.current[1]("bar");
    await vi.waitFor(() => expect(result.current[0]).toBe("bar"));
  });

  it("setting null removes the key", async () => {
    const updates: UrlUpdateEvent[] = [];
    const { result } = await renderHook(() => useQueryState("name"), {
      wrapper: wrapper("?name=foo", updates),
    });
    await result.current[1](null);
    await vi.waitFor(() => {
      expect(result.current[0]).toBeNull();
      expect(updates.at(-1)?.queryString).toBe("");
    });
  });

  it("functional updater receives previous value", async () => {
    const { result } = await renderHook(
      () => useQueryState("count", parseAsInteger.withDefault(0)),
      { wrapper: wrapper("?count=2") },
    );
    await result.current[1]((prev) => prev + 1);
    await vi.waitFor(() => expect(result.current[0]).toBe(3));
  });

  it("reports the committed query string via onUrlUpdate", async () => {
    const updates: UrlUpdateEvent[] = [];
    const { result } = await renderHook(() => useQueryState("q", parseAsString.withDefault("")), {
      wrapper: wrapper("", updates),
    });
    await result.current[1]("hello");
    await vi.waitFor(() => expect(updates.at(-1)?.queryString).toBe("q=hello"));
  });
});

describe("same-key synchronization", () => {
  function TwoConsumers() {
    const [a, setA] = useQueryState("k", parseAsString.withDefault(""));
    const [b] = useQueryState("k", parseAsString.withDefault(""));
    return (
      <div>
        <span data-testid="a">{a}</span>
        <span data-testid="b">{b}</span>
        <button type="button" onClick={() => void setA("synced")}>
          set
        </button>
      </div>
    );
  }

  it("a write from one hook is seen by another on the same key", async () => {
    const screen = await render(<TwoConsumers />, { wrapper: wrapper("") });
    await screen.getByText("set").click();
    await expect.element(screen.getByTestId("a")).toHaveTextContent("synced");
    await expect.element(screen.getByTestId("b")).toHaveTextContent("synced");
  });
});

describe("cross-hook batching", () => {
  it("merges same-tick updates from different hooks into one commit, same promise", async () => {
    const updates: UrlUpdateEvent[] = [];
    const { result } = await renderHook(
      () => ({
        a: useQueryState("a", parseAsString.withDefault("")),
        b: useQueryState("b", parseAsString.withDefault("")),
      }),
      { wrapper: wrapper("", updates) },
    );

    // Same event-loop tick → same Promise reference (nuqs guarantee).
    const pa = result.current.a[1]("1");
    const pb = result.current.b[1]("2");
    expect(pa).toBe(pb);
    await Promise.all([pa, pb]);

    expect(updates.length).toBe(1);
    expect(updates[0]?.searchParams.get("a")).toBe("1");
    expect(updates[0]?.searchParams.get("b")).toBe("2");
  });
});

describe("useQueryStates", () => {
  const parsers = {
    q: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(0),
    tags: parseAsNativeArrayOf(parseAsString),
  };

  it("reads all managed keys", async () => {
    const { result } = await renderHook(() => useQueryStates(parsers), {
      wrapper: wrapper("?q=hi&page=3&tags=a&tags=b"),
    });
    expect(result.current[0]).toEqual({ q: "hi", page: 3, tags: ["a", "b"] });
  });

  it("updates a subset, preserving the rest", async () => {
    const { result } = await renderHook(() => useQueryStates(parsers), {
      wrapper: wrapper("?q=hi&page=3"),
    });
    await result.current[1]({ page: 5 });
    await vi.waitFor(() => expect(result.current[0]).toEqual({ q: "hi", page: 5, tags: [] }));
  });

  it("preserves unmanaged params", async () => {
    const updates: UrlUpdateEvent[] = [];
    const { result } = await renderHook(() => useQueryStates({ q: parseAsString }), {
      wrapper: wrapper("?q=hi&keep=1", updates),
    });
    await result.current[1]({ q: "bye" });
    await vi.waitFor(() => expect(updates.at(-1)?.searchParams.get("keep")).toBe("1"));
  });

  it("null clears every managed key only", async () => {
    const updates: UrlUpdateEvent[] = [];
    const { result } = await renderHook(() => useQueryStates({ q: parseAsString }), {
      wrapper: wrapper("?q=hi&keep=1", updates),
    });
    await result.current[1](null);
    await vi.waitFor(() => {
      expect(updates.at(-1)?.searchParams.get("q")).toBeNull();
      expect(updates.at(-1)?.searchParams.get("keep")).toBe("1");
    });
  });

  it("urlKeys map logical names to short URL keys", async () => {
    const updates: UrlUpdateEvent[] = [];
    const { result } = await renderHook(
      () => useQueryStates({ query: parseAsString.withDefault("") }, { urlKeys: { query: "q" } }),
      { wrapper: wrapper("?q=found", updates) },
    );
    expect(result.current[0].query).toBe("found");
    await result.current[1]({ query: "next" });
    await vi.waitFor(() => expect(updates.at(-1)?.searchParams.get("q")).toBe("next"));
  });
});
