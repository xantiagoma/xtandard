import { describe, expect, test } from "vitest";

import { type QueryStateOptions, resolveOptions } from "../src/tanstack/core/options.ts";
import { throttle } from "../src/tanstack/core/rate-limit.ts";
import { type CommitInput, createQueryStateStore } from "../src/tanstack/core/store.ts";

function opts(overrides: QueryStateOptions = {}) {
  return resolveOptions({ callOptions: { limitUrlUpdates: throttle(0), ...overrides } });
}

function setKey(key: string, value: string) {
  return (current: URLSearchParams) => {
    const draft = new URLSearchParams(current);
    draft.set(key, value);
    return draft;
  };
}

describe("createQueryStateStore", () => {
  test("optimistic state updates synchronously, commit is deferred", async () => {
    const commits: CommitInput[] = [];
    const store = createQueryStateStore({
      initialSearch: "",
      commit: (input) => commits.push(input),
    });

    const promise = store.update({ options: opts(), updater: setKey("a", "1") });
    // State is updated immediately.
    expect(store.getSnapshot().queryString).toBe("a=1");
    // Commit has not fired yet (scheduled on a timer).
    expect(commits.length).toBe(0);

    await promise;
    expect(commits.length).toBe(1);
    expect(commits[0]?.search.toString()).toBe("a=1");
  });

  test("same-tick updates merge into a single commit", async () => {
    const commits: CommitInput[] = [];
    const store = createQueryStateStore({
      initialSearch: "",
      commit: (input) => commits.push(input),
    });

    const p1 = store.update({ options: opts(), updater: setKey("a", "1") });
    const p2 = store.update({ options: opts(), updater: setKey("b", "2") });
    await Promise.all([p1, p2]);

    expect(commits.length).toBe(1);
    expect(commits[0]?.search.toString()).toBe("a=1&b=2");
  });

  test("Infinity rate limit updates state but never commits", async () => {
    const commits: CommitInput[] = [];
    const store = createQueryStateStore({
      initialSearch: "",
      commit: (input) => commits.push(input),
    });

    await store.update({
      options: opts({ limitUrlUpdates: throttle(Infinity) }),
      updater: setKey("a", "1"),
    });

    expect(store.getSnapshot().queryString).toBe("a=1");
    expect(commits.length).toBe(0);
  });

  test("commit receives the loudest combined options", async () => {
    const commits: CommitInput[] = [];
    const store = createQueryStateStore({
      initialSearch: "",
      commit: (input) => commits.push(input),
    });

    const p1 = store.update({ options: opts({ history: "replace" }), updater: setKey("a", "1") });
    const p2 = store.update({ options: opts({ history: "push" }), updater: setKey("b", "2") });
    await Promise.all([p1, p2]);

    expect(commits[0]?.options.history).toBe("push");
  });

  test("syncFromSearch reconciles external changes and notifies", () => {
    const store = createQueryStateStore({ initialSearch: "a=1", commit: () => {} });
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    store.syncFromSearch("a=2&b=3");
    expect(store.getSnapshot().queryString).toBe("a=2&b=3");
    expect(notified).toBe(1);

    // No-op when unchanged.
    store.syncFromSearch("a=2&b=3");
    expect(notified).toBe(1);
  });

  test("processSearchParams runs before state + commit", async () => {
    const commits: CommitInput[] = [];
    const store = createQueryStateStore({
      initialSearch: "",
      commit: (input) => commits.push(input),
      processSearchParams: (params) => {
        params.set("injected", "1");
        return params;
      },
    });

    await store.update({ options: opts(), updater: setKey("a", "1") });
    expect(store.getSnapshot().searchParams.get("injected")).toBe("1");
    expect(commits[0]?.search.get("injected")).toBe("1");
  });
});
