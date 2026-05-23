import { up } from "up-fetch";

export type ProgressInfo = {
  direction: "upload" | "download";
  transferred: number;
  total?: number;
};

export type FetchWithProgressInit = RequestInit & {
  onProgress?: (info: ProgressInfo) => void;
};

let _upfetch: ReturnType<typeof up> | null = null;

function getUpfetch() {
  if (!_upfetch) {
    _upfetch = up(fetch, () => ({
      reject: () => false,
      parseResponse: (response: Response) => Promise.resolve(response),
    }));
  }
  return _upfetch;
}

/**
 * Drop-in fetch replacement that adds upload/download progress tracking.
 * Compatible with Eden Treaty's `fetcher` option.
 *
 * @example
 * ```ts
 * const client = treaty<App>(url, {
 *   fetcher: fetchWithProgress as typeof fetch,
 *   fetch: { credentials: "include" },
 * });
 *
 * // With progress:
 * await client.api.upload.post(formData, {
 *   onProgress: ({ direction, transferred, total }) => {
 *     console.log(`${direction}: ${transferred}/${total}`);
 *   },
 * });
 * ```
 */
export function fetchWithProgress(
  input: RequestInfo | URL,
  init: FetchWithProgressInit = {},
): Promise<Response> {
  const { onProgress, signal, ...restInit } = init;

  const upfetchOptions = {
    ...restInit,
    signal: signal ?? undefined,
  };

  if (!onProgress) {
    return getUpfetch()(input as Request, upfetchOptions);
  }

  return getUpfetch()(input as Request, {
    ...upfetchOptions,
    onRequestStreaming: ({ transferredBytes, totalBytes }) => {
      onProgress({ direction: "upload", transferred: transferredBytes, total: totalBytes });
    },
    onResponseStreaming: ({ transferredBytes, totalBytes }) => {
      onProgress({ direction: "download", transferred: transferredBytes, total: totalBytes });
    },
  });
}
