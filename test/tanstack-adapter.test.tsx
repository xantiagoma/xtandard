import {
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "vitest-browser-react";

import { parseAsNativeArrayOf, parseAsString } from "../src/tanstack/core/built-in-parsers.ts";
import { useQueryState } from "../src/tanstack/react/use-query-state.ts";
import { NuqsAdapter } from "../src/tanstack/adapters/tanstack-router.tsx";

// Reproduces the playground exactly: a real TanStack Router (which patches
// history and JSON-serializes search globally) + the inline-parser toggle flow.
// Regression guard for repeated-key arrays getting re-ingested as nested JSON.

function Tags() {
  const [tags, setTags] = useQueryState("tag", parseAsNativeArrayOf(parseAsString));
  return (
    <div>
      <span data-testid="val">{JSON.stringify(tags)}</span>
      {["react", "url", "state"].map((t) => (
        <button
          key={t}
          type="button"
          data-testid={t}
          onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function makeRouter(history = createBrowserHistory()) {
  const rootRoute = createRootRoute({
    component: () => (
      <NuqsAdapter>
        <Tags />
      </NuqsAdapter>
    ),
  });
  return createRouter({ routeTree: rootRoute, history, defaultPendingMinMs: 0 });
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("TanStack Router adapter — native arrays survive the round-trip", () => {
  it("toggling repeated-key tags stays repeated keys (no nested JSON)", async () => {
    const router = makeRouter();
    const screen = await render(<RouterProvider router={router} />);
    const val = () => screen.getByTestId("val").element().textContent;

    await vi.waitFor(() => expect(val()).toBe("[]"));

    // Each click reads the latest rendered `tags`, so wait for the value to
    // reflect each step before issuing the next click.
    const steps: ReadonlyArray<readonly [string, string]> = [
      ["react", '["react"]'],
      ["url", '["react","url"]'],
      ["state", '["react","url","state"]'],
    ];
    for (const [button, expected] of steps) {
      await screen.getByTestId(button).click();
      await vi.waitFor(() => expect(val()).toBe(expected));
    }

    // Assert on the `tag` params specifically (not the whole query string —
    // the browser test harness injects its own sessionId/iframeId params).
    // Repeated keys → getAll returns 3 entries; a regression to nested JSON
    // (`?tag=["react",…]`) would collapse to a single entry, so this guards it.
    const tagParams = () => new URLSearchParams(window.location.search).getAll("tag");
    await vi.waitFor(() => expect(tagParams()).toEqual(["react", "url", "state"]));

    // Deselect one — still clean repeated keys.
    await screen.getByTestId("url").click();
    await vi.waitFor(() => expect(val()).toBe('["react","state"]'));
    await vi.waitFor(() => expect(tagParams()).toEqual(["react", "state"]));
  });

  it("seeds repeated-key arrays from the raw URL (Start/SSR path via memory history)", async () => {
    // Memory history mirrors how Start seeds on the server from the request
    // URL — read from history.location (raw), not the re-serialized searchStr.
    const router = makeRouter(createMemoryHistory({ initialEntries: ["/?tag=react&tag=url"] }));
    const screen = await render(<RouterProvider router={router} />);

    await vi.waitFor(() =>
      expect(screen.getByTestId("val").element().textContent).toBe('["react","url"]'),
    );
  });
});
