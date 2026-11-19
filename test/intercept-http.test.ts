// Node (server) runtime: `fetch` exists, `XMLHttpRequest` does not.
// The browser behaviour is covered by intercept-http.test.tsx.
import { describe, test, expect, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { createHttpInterceptor, type InterceptEvent } from "../src/intercept-http.ts";
import { server } from "./setup-msw.ts";

describe("createHttpInterceptor without XMLHttpRequest (server runtimes)", () => {
  let interceptor: ReturnType<typeof createHttpInterceptor> | null = null;

  afterEach(() => {
    interceptor?.restore();
    interceptor = null;
  });

  test("does not throw, and patches only fetch", () => {
    expect(globalThis.XMLHttpRequest).toBeUndefined();
    const originalFetch = globalThis.fetch;

    interceptor = createHttpInterceptor();

    expect(globalThis.fetch).not.toBe(originalFetch);
    expect(globalThis.XMLHttpRequest).toBeUndefined();
  });

  test("intercepts fetch", async () => {
    server.use(http.get("https://api.example.test/users", () => HttpResponse.json([{ id: 1 }])));
    interceptor = createHttpInterceptor();
    const events: InterceptEvent[] = [];
    interceptor.addRule({ path: "/users", onIntercept: (e) => events.push(e) });

    await fetch("https://api.example.test/users");

    expect(events).toHaveLength(1);
    expect(events[0]!.transport).toBe("fetch");
    expect(events[0]!.response.body).toEqual({ kind: "json", value: [{ id: 1 }] });
  });

  test("restore() puts back the original fetch itself", () => {
    const originalFetch = globalThis.fetch;
    createHttpInterceptor().restore();
    expect(globalThis.fetch).toBe(originalFetch);
  });

  test("with neither fetch nor XMLHttpRequest, patches nothing", () => {
    const originalFetch = globalThis.fetch;
    // @ts-expect-error simulate a runtime without fetch
    delete globalThis.fetch;
    try {
      const bare = createHttpInterceptor();
      expect(globalThis.fetch).toBeUndefined();
      bare.restore();
      expect(globalThis.fetch).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
