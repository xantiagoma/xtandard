/**
 * Toast helpers that stream iterables/generators through Sonner (peers `sonner`, `react`).
 *
 * Import from `@xtandard/lib/sonner`.
 *
 * @module sonner
 */

export { toastStream, toastStreamAsync } from "./toast-stream.ts";
export type {
  DelayConfig,
  ErrorPartialData,
  LoadingExtendedResult,
  LoadingExtendedResultT,
  LoadingResultT,
  StreamErrorResultT,
  StreamExtendedErrorResultT,
  StreamExtendedResult,
  StreamExtendedResultT,
  StreamExternalToast,
  StreamingData,
  StreamResult,
  StreamResultT,
  SuccessData,
  ToastStreamData,
  ToastStreamReturn,
} from "./toast-stream.ts";
