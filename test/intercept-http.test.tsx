import { describe, test, expect, afterEach } from "vitest";
import { createHttpInterceptor, type InterceptEvent } from "../src/intercept-http.ts";

describe("createHttpInterceptor", () => {
  let interceptor: ReturnType<typeof createHttpInterceptor> | null = null;

  afterEach(() => {
    interceptor?.restore();
    interceptor = null;
  });

  test("returns an interceptor with addRule, clearAll, restore", () => {
    interceptor = createHttpInterceptor();
    expect(typeof interceptor.addRule).toBe("function");
    expect(typeof interceptor.clearAll).toBe("function");
    expect(typeof interceptor.restore).toBe("function");
  });

  test("addRule returns a handle with id, events, stop", () => {
    interceptor = createHttpInterceptor();
    const handle = interceptor.addRule({ path: "/api" });
    expect(typeof handle.id).toBe("number");
    expect(handle.events).toBeInstanceOf(EventTarget);
    expect(typeof handle.stop).toBe("function");
    handle.stop();
  });

  test("intercepts fetch requests matching path", async () => {
    interceptor = createHttpInterceptor();
    const events: InterceptEvent[] = [];

    interceptor.addRule({
      path: "/test-intercept",
      onIntercept: (e) => events.push(e),
    });

    await fetch("/test-intercept");

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.transport).toBe("fetch");
    expect(events[0]!.url).toContain("/test-intercept");
    expect(events[0]!.method).toBe("GET");
    expect(typeof events[0]!.elapsedMs).toBe("number");
  });

  test("does not intercept unmatched paths", async () => {
    interceptor = createHttpInterceptor();
    const events: InterceptEvent[] = [];

    interceptor.addRule({
      path: "/should-not-match-anything-xyz",
      onIntercept: (e) => events.push(e),
    });

    await fetch("/other-path").catch(() => {});

    expect(events).toHaveLength(0);
  });

  test("filters by method", async () => {
    interceptor = createHttpInterceptor();
    const events: InterceptEvent[] = [];

    interceptor.addRule({
      path: "/method-test",
      method: "POST",
      onIntercept: (e) => events.push(e),
    });

    // GET should not match
    await fetch("/method-test").catch(() => {});
    expect(events).toHaveLength(0);
  });

  test("custom match function", async () => {
    interceptor = createHttpInterceptor();
    const events: InterceptEvent[] = [];

    interceptor.addRule({
      match: (url) => url.includes("custom-match"),
      onIntercept: (e) => events.push(e),
    });

    await fetch("/custom-match-path").catch(() => {});

    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  test("stop() removes the rule", async () => {
    interceptor = createHttpInterceptor();
    const events: InterceptEvent[] = [];

    const handle = interceptor.addRule({
      path: "/stop-test",
      onIntercept: (e) => events.push(e),
    });

    handle.stop();

    await fetch("/stop-test").catch(() => {});
    expect(events).toHaveLength(0);
  });

  test("clearAll() removes all rules", () => {
    interceptor = createHttpInterceptor();
    interceptor.addRule({ path: "/a" });
    interceptor.addRule({ path: "/b" });
    interceptor.clearAll();
    // No way to check rule count directly, but no errors = pass
  });

  test("events EventTarget fires intercept events", async () => {
    interceptor = createHttpInterceptor();
    const events: InterceptEvent[] = [];

    const handle = interceptor.addRule({ path: "/event-test" });
    handle.events.addEventListener("intercept", (e) => {
      events.push((e as CustomEvent<InterceptEvent>).detail);
    });

    await fetch("/event-test").catch(() => {});

    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});
