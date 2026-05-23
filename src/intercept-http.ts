/**
 * Browser HTTP interceptor for `fetch` and `XMLHttpRequest`.
 * Patches both APIs to capture requests/responses based on configurable rules.
 * Useful for debugging, analytics, monitoring, and testing.
 *
 * @example
 * ```ts
 * import { createHttpInterceptor } from "xantiagoma/web";
 *
 * const interceptor = createHttpInterceptor();
 *
 * // Intercept all POST requests to a specific path
 * const handle = interceptor.addRule({
 *   name: "api-posts",
 *   path: "/api/posts",
 *   method: "POST",
 *   onIntercept: (event) => {
 *     console.log("Intercepted:", event.method, event.url, event.response.body);
 *   },
 * });
 *
 * // Stop intercepting
 * handle.stop();
 *
 * // Remove all patches and restore originals
 * interceptor.restore();
 * ```
 */

// --- Types ---

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type BodyResult =
  | { kind: "json"; value: unknown }
  | { kind: "text"; value: string }
  | { kind: "opaque"; value: string }
  | { kind: "error"; value: string };

export interface InterceptEvent {
  /** Which transport was intercepted */
  transport: "fetch" | "xhr";
  /** ISO timestamp */
  ts: string;
  /** Request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Response status code */
  status: number;
  /** Whether status is 2xx */
  ok: boolean;
  /** Round-trip time in ms */
  elapsedMs: number;
  /** Rule ID that matched */
  ruleId: number;
  /** Rule name (if provided) */
  ruleName?: string;
  /** Request details */
  request: {
    headers: Record<string, string> | HeadersInit | null;
    body: string | null;
  };
  /** Response details */
  response: {
    headers: Record<string, string>;
    body: BodyResult;
  };
}

export interface InterceptRule {
  /** Human-readable name for this rule */
  name?: string;
  /** URL substring to match (simple matching) */
  path?: string;
  /** HTTP method to match (case-insensitive). If omitted, matches all methods. */
  method?: HttpMethod | string;
  /** Custom match function. If provided, `path` is ignored. */
  match?: (url: string, method: string) => boolean;
  /** Max chars for body truncation. Default: 5000. */
  maxBodyChars?: number;
  /** Callback fired on each intercepted request matching this rule */
  onIntercept?: (event: InterceptEvent) => void;
}

export interface InterceptHandle {
  /** Unique ID of this rule */
  id: number;
  /** EventTarget — listen with `handle.events.addEventListener("intercept", e => ...)` */
  events: EventTarget;
  /** Remove this rule */
  stop: () => void;
}

export interface HttpInterceptor {
  /** Add a new interception rule */
  addRule: (rule: InterceptRule) => InterceptHandle;
  /** Remove all rules */
  clearAll: () => void;
  /** Remove all rules AND restore original fetch/XHR */
  restore: () => void;
}

// --- Implementation ---

function toObjHeaders(headers: Headers | undefined): Record<string, string> {
  const o: Record<string, string> = {};
  if (!headers) return o;
  try {
    headers.forEach((v, k) => {
      o[k] = v;
    });
  } catch {
    // noop
  }
  return o;
}

function parseXhrHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      out[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
  }
  return out;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}… (truncated, ${s.length} chars)` : s;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

async function readFetchBody(res: Response, maxBodyChars: number): Promise<BodyResult> {
  try {
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      return { kind: "json", value: await res.json() };
    }
    if (
      ct.includes("text/") ||
      ct.includes("application/xml") ||
      ct.includes("application/xhtml")
    ) {
      const t = await res.text();
      return { kind: "text", value: truncate(t, maxBodyChars) };
    }
    try {
      return { kind: "json", value: await res.json() };
    } catch {
      return { kind: "opaque", value: `[non-text content-type: ${ct || "unknown"}]` };
    }
  } catch (e) {
    return { kind: "error", value: String(e instanceof Error ? e.message : e) };
  }
}

interface NormalizedRule extends Required<Omit<InterceptRule, "path" | "match" | "onIntercept">> {
  id: number;
  path?: string;
  match?: (url: string, method: string) => boolean;
  onIntercept?: (event: InterceptEvent) => void;
  events: EventTarget;
}

function shouldFire(rule: NormalizedRule, ctx: { url: string; method: string }): boolean {
  if (rule.method && rule.method.toUpperCase() !== ctx.method.toUpperCase()) return false;
  if (typeof rule.match === "function") return !!rule.match(ctx.url, ctx.method);
  if (rule.path) return ctx.url.includes(rule.path);
  return true;
}

function fire(rule: NormalizedRule, payload: Omit<InterceptEvent, "ruleId" | "ruleName">): void {
  const evt: InterceptEvent = {
    ...payload,
    ruleId: rule.id,
    ruleName: rule.name || undefined,
  };
  try {
    rule.onIntercept?.(evt);
  } catch (e) {
    console.warn("[intercept-http] onIntercept error:", e);
  }
  try {
    rule.events.dispatchEvent(new CustomEvent("intercept", { detail: evt }));
  } catch {
    // noop
  }
}

/**
 * Create an HTTP interceptor that patches `fetch` and `XMLHttpRequest`
 * to capture requests/responses based on configurable rules.
 *
 * @returns An {@link HttpInterceptor} with `addRule`, `clearAll`, and `restore` methods.
 *
 * @example
 * ```ts
 * const interceptor = createHttpInterceptor();
 *
 * const handle = interceptor.addRule({
 *   path: "/api/users",
 *   onIntercept: (e) => console.log(e.status, e.response.body),
 * });
 *
 * // With custom matching
 * interceptor.addRule({
 *   match: (url) => url.includes("/api/") && !url.includes("/health"),
 *   method: "POST",
 *   onIntercept: (e) => analytics.track("api_call", e),
 * });
 *
 * // Listen via EventTarget
 * handle.events.addEventListener("intercept", (e) => {
 *   console.log((e as CustomEvent<InterceptEvent>).detail);
 * });
 *
 * // Cleanup
 * handle.stop();           // remove one rule
 * interceptor.clearAll();  // remove all rules
 * interceptor.restore();   // remove all rules + restore original fetch/XHR
 * ```
 */
export function createHttpInterceptor(): HttpInterceptor {
  const rules = new Map<number, NormalizedRule>();
  let nextId = 1;

  // --- Patch fetch ---
  const origFetch = globalThis.fetch.bind(globalThis);

  (globalThis as any).fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const start = nowMs();
    const url = input instanceof Request ? input.url : String(input);
    const method = (
      init?.method ||
      (input instanceof Request ? input.method : "GET") ||
      "GET"
    ).toUpperCase();

    const reqBody =
      init && "body" in init
        ? typeof init.body === "string"
          ? init.body
          : init.body != null
            ? `[${typeof init.body}]`
            : null
        : null;

    const res = await origFetch(input, init);

    if (rules.size === 0) return res;

    const matched: NormalizedRule[] = [];
    for (const rule of rules.values()) {
      if (shouldFire(rule, { url, method })) matched.push(rule);
    }
    if (matched.length === 0) return res;

    const elapsedMs = Math.round(nowMs() - start);
    for (const rule of matched) {
      const clone = res.clone();
      const body = await readFetchBody(clone, rule.maxBodyChars);

      fire(rule, {
        transport: "fetch",
        ts: new Date().toISOString(),
        url,
        method,
        status: res.status,
        ok: res.ok,
        elapsedMs,
        request: {
          headers: init?.headers ? (init.headers as Record<string, string>) : null,
          body: reqBody ? truncate(reqBody, rule.maxBodyChars) : null,
        },
        response: {
          headers: toObjHeaders(res.headers),
          body,
        },
      });
    }

    return res;
  };

  // --- Patch XHR ---
  const XHR = globalThis.XMLHttpRequest;
  const origOpen = XHR.prototype.open;
  const origSend = XHR.prototype.send;
  const origSetHeader = XHR.prototype.setRequestHeader;

  interface XHRMeta {
    method: string;
    url: string;
    start: number;
    reqHeaders: Record<string, string>;
    reqBody: string | null;
  }

  XHR.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    (this as any).__httpInterceptMeta = {
      method: String(method || "GET").toUpperCase(),
      url: String(url),
      start: 0,
      reqHeaders: {},
      reqBody: null,
    } satisfies XHRMeta;
    return origOpen.call(this, method, url, async ?? true, username, password);
  };

  XHR.prototype.setRequestHeader = function (k: string, v: string) {
    const meta = (this as any).__httpInterceptMeta as XHRMeta | undefined;
    if (meta) meta.reqHeaders[String(k).toLowerCase()] = String(v);
    return origSetHeader.call(this, k, v);
  };

  XHR.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = (this as any).__httpInterceptMeta as XHRMeta | undefined;
    if (meta) {
      meta.start = nowMs();
      meta.reqBody = typeof body === "string" ? body : body != null ? `[${typeof body}]` : null;
    }

    this.addEventListener("loadend", () => {
      if (!meta || rules.size === 0) return;

      const matched: NormalizedRule[] = [];
      for (const rule of rules.values()) {
        if (shouldFire(rule, { url: meta.url, method: meta.method })) matched.push(rule);
      }
      if (matched.length === 0) return;

      const elapsedMs = Math.round(nowMs() - meta.start);

      let parsedBody: BodyResult;
      try {
        parsedBody = { kind: "json", value: JSON.parse(this.responseText) };
      } catch {
        const maxChars = Math.max(...matched.map((r) => r.maxBodyChars));
        parsedBody = { kind: "text", value: truncate(String(this.responseText || ""), maxChars) };
      }

      for (const rule of matched) {
        fire(rule, {
          transport: "xhr",
          ts: new Date().toISOString(),
          url: meta.url,
          method: meta.method,
          status: this.status,
          ok: this.status >= 200 && this.status < 300,
          elapsedMs,
          request: {
            headers: meta.reqHeaders,
            body: meta.reqBody ? truncate(meta.reqBody, rule.maxBodyChars) : null,
          },
          response: {
            headers: parseXhrHeaders(this.getAllResponseHeaders?.() || ""),
            body:
              parsedBody.kind === "text"
                ? { kind: "text", value: truncate(parsedBody.value as string, rule.maxBodyChars) }
                : parsedBody,
          },
        });
      }
    });

    return origSend.call(this, body);
  };

  // --- Public API ---
  return {
    addRule(rule: InterceptRule): InterceptHandle {
      const id = nextId++;
      const events = new EventTarget();

      const normalized: NormalizedRule = {
        id,
        name: rule.name ?? "",
        method: rule.method ?? "",
        path: rule.path,
        match: rule.match,
        maxBodyChars: rule.maxBodyChars ?? 5000,
        onIntercept: rule.onIntercept,
        events,
      };

      rules.set(id, normalized);

      return {
        id,
        events,
        stop() {
          rules.delete(id);
        },
      };
    },

    clearAll() {
      rules.clear();
    },

    restore() {
      rules.clear();
      (globalThis as any).fetch = origFetch;
      XHR.prototype.open = origOpen;
      XHR.prototype.send = origSend;
      XHR.prototype.setRequestHeader = origSetHeader;
    },
  };
}
