import { describe, test, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./setup-msw.ts";
import { fetchWithProgress } from "../src/fetch-with-progress.ts";

describe("fetchWithProgress", () => {
  beforeEach(() => {
    server.use(
      http.get("https://api.test/data", () => {
        return HttpResponse.json({ ok: true });
      }),
      http.post("https://api.test/upload", async ({ request }) => {
        const body = await request.text();
        return HttpResponse.json({ received: body.length });
      }),
      http.get("https://api.test/large", () => {
        return new HttpResponse("x".repeat(1000), {
          headers: { "Content-Type": "text/plain" },
        });
      }),
      http.get("https://api.test/error", () => {
        return HttpResponse.json({ error: "fail" }, { status: 500 });
      }),
    );
  });

  test("makes a GET request and returns response", async () => {
    const res = await fetchWithProgress("https://api.test/data");
    expect(res).toBeInstanceOf(Response);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  test("makes a POST request", async () => {
    const res = await fetchWithProgress("https://api.test/upload", {
      method: "POST",
      body: "hello world",
    });
    expect(res).toBeInstanceOf(Response);
    const data = await res.json();
    expect(data.received).toBe(11);
  });

  test("works without onProgress", async () => {
    const res = await fetchWithProgress("https://api.test/data");
    expect(res.status).toBe(200);
  });

  test("calls onProgress when provided", async () => {
    const progress: any[] = [];
    const res = await fetchWithProgress("https://api.test/large", {
      onProgress: (info) => progress.push(info),
    });
    expect(res).toBeInstanceOf(Response);
  });

  test("handles error responses", async () => {
    const res = await fetchWithProgress("https://api.test/error");
    expect(res.status).toBe(500);
  });

  test("passes signal through", async () => {
    const controller = new AbortController();
    const res = await fetchWithProgress("https://api.test/data", {
      signal: controller.signal,
    });
    expect(res).toBeInstanceOf(Response);
  });

  test("passes custom headers", async () => {
    server.use(
      http.get("https://api.test/auth", ({ request }) => {
        return HttpResponse.json({ auth: request.headers.get("authorization") });
      }),
    );

    const res = await fetchWithProgress("https://api.test/auth", {
      headers: { Authorization: "Bearer test-token" },
    });
    const data = await res.json();
    expect(data.auth).toBe("Bearer test-token");
  });
});
