---
title: "Web"
description: "Browser-side helpers: FormData to a plain object, readable query strings, fetch with upload/download progress, and an HTTP interceptor for fetch and XHR."
---

`@xtandard/lib/web` collects small helpers for code that talks to the browser's form and network APIs: turning a `FormData` into an object, keeping structured query strings readable, tracking request progress, and observing `fetch`/`XMLHttpRequest` traffic.

```sh
npm install @xtandard/lib up-fetch
```

```ts
import {
  formDataToObject,
  keepSubDelims,
  fetchWithProgress,
  createHttpInterceptor,
} from "@xtandard/lib/web";
```

:::note[Peer dependency and where things run]
`up-fetch` is an optional peer dependency, but the entry imports it at module load (it backs `fetchWithProgress`), so install it whenever you import from `@xtandard/lib/web`.

`formDataToObject`, `keepSubDelims` and `fetchWithProgress` work anywhere the standard `FormData`, `URLSearchParams` and `fetch` globals exist (browsers, Node 18+, Bun, Deno). `createHttpInterceptor` is **browser-only**: it patches `XMLHttpRequest`, which servers don't have.
:::

## `formDataToObject`

Converts a `FormData` into a plain object. A key that appears once becomes a single value; a key that appears more than once (checkbox groups, multi-selects) becomes an array, in submission order.

```ts
import { formDataToObject } from "@xtandard/lib/web";

const form = new FormData();
form.append("name", "Ada");
form.append("tag", "math");
form.append("tag", "code");

const data = formDataToObject<{ name: string; tag: string | string[] }>(form);
// { name: "Ada", tag: ["math", "code"] }
```

The generic parameter is only a cast: nothing is validated or coerced. Values stay `string` (or `File`). A field that can have one _or_ many values comes back as a string when only one was sent, so type it as `string | string[]` and normalize it, or run the result through a schema. An empty `FormData` gives `{}`.

## `keepSubDelims`

Serializes `URLSearchParams` like `params.toString()`, but leaves the RFC 3986 sub-delimiters `( ) , : ! '` unencoded. They round-trip through `new URLSearchParams(...)` unchanged, so the result is the same data; it just stays readable in the address bar. That matters for structured values such as [Rison](@BASE@/tanstack/)-encoded filters.

```ts
import { keepSubDelims } from "@xtandard/lib/web";

const params = new URLSearchParams({ where: "(type:and,nodes:!())", page: "2" });

params.toString(); // "where=%28type%3Aand%2Cnodes%3A%21%28%29%29&page=2"
keepSubDelims(params); // "where=(type:and,nodes:!())&page=2"
```

`&`, `=` and `+` are still percent-encoded, so separators survive. The usual place for it is the TanStack query-state adapter's `serializeSearch` prop. The same function is re-exported from `@xtandard/lib/tanstack` and `@xtandard/lib/tanstack/server` for convenience:

```tsx
import { NuqsAdapter, keepSubDelims } from "@xtandard/lib/tanstack";

<NuqsAdapter serializeSearch={keepSubDelims}>
  <App />
</NuqsAdapter>;
```

## `fetchWithProgress`

A drop-in `fetch` replacement that reports upload and download progress through an extra `onProgress` option. It returns a normal `Response`.

```ts
import { fetchWithProgress, type ProgressInfo } from "@xtandard/lib/web";

const res = await fetchWithProgress("/api/export", {
  headers: { Authorization: `Bearer ${token}` },
  onProgress: ({ direction, transferred, total }: ProgressInfo) => {
    // direction: "upload" | "download"; total is undefined when the size is unknown
    console.log(direction, transferred, total);
  },
});
const blob = await res.blob();
```

`ProgressInfo` is `{ direction: "upload" | "download"; transferred: number; total?: number }`. Without `onProgress` it behaves exactly like `fetch`. `signal`, headers and the other `RequestInit` fields are passed through.

Because its signature matches `fetch`, you can hand it to clients that accept a custom fetcher, for example Eden Treaty:

```ts
const client = treaty<App>(url, {
  fetcher: fetchWithProgress as typeof fetch,
});

await client.api.upload.post(formData, {
  onProgress: ({ direction, transferred, total }) => {
    console.log(`${direction}: ${transferred}/${total}`);
  },
});
```

:::caution
Like native `fetch`, it **does not throw on HTTP error statuses**: a 500 resolves to a `Response` with `ok === false`. Check `res.ok` yourself.
:::

Progress comes from `up-fetch`'s request and response streaming hooks. A response without a `Content-Length` header reports `total` as `undefined`. Upload events are only emitted for requests that have a body, and `up-fetch` skips request streaming in Safari/WebKit, so expect only download events there.

## `createHttpInterceptor`

Patches `globalThis.fetch` and `XMLHttpRequest` so you can observe matching requests and their responses, without changing them. Use it for debugging panels, analytics, or test assertions in the browser. Each call returns an interceptor; you add rules to it.

```ts
import { createHttpInterceptor, type InterceptEvent } from "@xtandard/lib/web";

const interceptor = createHttpInterceptor();

// Match by URL substring (+ optional method)
const handle = interceptor.addRule({
  name: "create-post",
  path: "/api/posts",
  method: "POST",
  onIntercept: (event: InterceptEvent) => {
    console.log(event.transport, event.status, event.elapsedMs, event.response.body);
  },
});

// Or match with a predicate (when `match` is set, `path` is ignored)
interceptor.addRule({
  match: (url, method) => url.includes("/api/") && !url.includes("/health"),
  maxBodyChars: 1_000,
  onIntercept: (e) => analytics.track("api_call", { url: e.url, ok: e.ok }),
});

// Each rule also has an EventTarget
handle.events.addEventListener("intercept", (e) => {
  console.log((e as CustomEvent<InterceptEvent>).detail);
});

handle.stop(); // remove one rule
interceptor.clearAll(); // remove all rules, keep the patches
interceptor.restore(); // remove all rules and restore the original fetch/XHR
```

A rule (`InterceptRule`) can have:

| Field          | Meaning                                                               |
| -------------- | --------------------------------------------------------------------- |
| `name`         | Label copied to `event.ruleName`.                                     |
| `path`         | URL substring to match. No `path` and no `match` matches every URL.   |
| `method`       | HTTP method, case-insensitive. Omitted means any method.              |
| `match`        | `(url, method) => boolean`. Takes precedence over `path`.             |
| `maxBodyChars` | Truncate request/response text bodies to this length. Default `5000`. |
| `onIntercept`  | Called with an `InterceptEvent` for each matching response.           |

Each `InterceptEvent` has `transport` (`"fetch"` or `"xhr"`), `ts` (ISO timestamp), `url`, `method`, `status`, `ok`, `elapsedMs`, `ruleId`/`ruleName`, `request: { headers, body }` and `response: { headers, body }`. The response `body` is a `BodyResult`: `{ kind: "json" | "text" | "opaque" | "error", value }`. For `fetch`, the interceptor reads a **clone** of the response, so your code can still consume the original.

Things to know:

- Events fire after the response arrives. Errors in `onIntercept` are caught and logged with `console.warn`; they never break the request.
- Request bodies are only captured as text when they are strings. Other bodies (`FormData`, `Blob`, streams) appear as a placeholder like `"[object]"`.
- Every `createHttpInterceptor()` call wraps whatever `fetch` is current. Create one per page and call `restore()` when done (in tests, in `afterEach`).
- Do not call it on the server. Without `XMLHttpRequest` it throws, and by then `fetch` has already been patched.

## See also

- API reference: [`formDataToObject`](@BASE@/api/web/functions/formdatatoobject/), [`keepSubDelims`](@BASE@/api/tanstack/server/functions/keepsubdelims/), [`fetchWithProgress`](@BASE@/api/web/functions/fetchwithprogress/), [`createHttpInterceptor`](@BASE@/api/web/functions/createhttpinterceptor/), [`InterceptRule`](@BASE@/api/web/interfaces/interceptrule/), [`InterceptEvent`](@BASE@/api/web/interfaces/interceptevent/)
- Source: [`intercept-http.ts`](@REPO@/blob/main/src/intercept-http.ts), [`fetch-with-progress.ts`](@REPO@/blob/main/src/fetch-with-progress.ts)
