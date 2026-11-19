/**
 * Compile-time checks that the types used by public signatures are importable from the
 * same public path as the function that uses them (`src/index.ts` / `src/entry-*.ts`).
 * Checked by `tsc --noEmit` (via `bun run check`); not run by the test runner.
 */
import type { Equal, Expect, Extends } from "type-testing";

import {
  jaroWinklerDistance,
  jaroWinklerSimilarity,
  defer,
  deferSync,
  makeDisposable,
  tryCatch,
  tryCatchSync,
  type Deferred,
  type DeferOptions,
  type DeferredSync,
  type MadeDisposable,
  type MakeDisposableOptions,
  type PrepareLoaderResultManyOptions,
  type PrepareLoaderResultOneOptions,
  type Result,
  type StreamSourceInstance,
  type TryCatchReturn,
} from "../src/index.ts";
import { bigDomain, type BigValue } from "../src/entry-big.ts";
import { fractionDomain, type FractionValue } from "../src/entry-fraction.ts";
import { OPERATOR_CODE, type AnyOperator } from "../src/entry-filters.ts";
import type { Fragment } from "../src/entry-filters-knex.ts";
import type {
  AnyProps,
  RenderProp,
  RenderPropNoData,
  StreamSourceWithReturn,
  UseStreamAccumulateOptions,
  UseStreamBaseOptions,
  UseStreamLatestOptions,
  UseStreamMaxItemsOptions,
  UseStreamOptions,
  UseStreamReducerOptions,
  UseStreamSource,
} from "../src/entry-react.ts";
import {
  toastStreamAsync,
  type StreamResult,
  type ToastStreamData,
  type ToastStreamReturn,
} from "../src/entry-sonner.ts";
import {
  createQueryStateStore,
  type AdapterValue,
  type CommitFn,
  type CommitInput,
  type Eq,
  type JsonValidator,
  type QueryStateStore,
  type ReadValue,
  type SchemaInput,
  type SerializerBase,
  type Snapshot,
  type StoreUpdate,
  type Transport,
} from "../src/entry-tanstack.ts";
import type {
  Eq as ServerEq,
  JsonValidator as ServerJsonValidator,
  SerializerBase as ServerSerializerBase,
  SchemaInput as ServerSchemaInput,
  Transport as ServerTransport,
} from "../src/entry-tanstack-server.ts";
import type { Cache, CacheMethodDecorator } from "../src/entry-unstorage.ts";
import { durationToMs, type DurationToMsOptions } from "../src/entry-temporal.ts";
import { fetchWithProgress, type FetchWithProgressInit } from "../src/entry-web.ts";

// ─── core ────────────────────────────────────────────────────────────────────

export type _Result = Expect<Equal<Result<number, Error>, [number, null] | [null, Error]>>;
export type _TryCatchSync = Expect<
  Equal<ReturnType<typeof tryCatchSync<number, Error>>, Result<number, Error>>
>;
export type _TryCatchReturn = Expect<
  Equal<TryCatchReturn<Promise<number>>, Promise<Result<number>>>
>;
const syncResult = tryCatch(() => "x");
export type _TryCatchFn = Expect<Equal<typeof syncResult, TryCatchReturn<string, Error>>>;
export type _TryCatchSyncShape = Expect<Equal<TryCatchReturn<string>, Result<string>>>;
export type _Deferred = Expect<Equal<ReturnType<typeof defer>, Deferred>>;
export type _DeferredSync = Expect<Equal<ReturnType<typeof deferSync>, DeferredSync>>;
export type _DeferOptions = Expect<Equal<Parameters<typeof defer>[1], DeferOptions | undefined>>;
export type _MakeDisposable = Expect<
  Equal<Awaited<ReturnType<typeof makeDisposable<{ a: 1 }>>>, MadeDisposable<{ a: 1 }>>
>;
export type _MakeDisposableOptions = Expect<
  Extends<{ overwrite: true }, MakeDisposableOptions<{ a: 1 }>>
>;
export type _PrepareOne = Expect<
  Extends<
    { keys: string[]; results: number[] },
    PrepareLoaderResultOneOptions<string, number, number, null>
  >
>;
export type _PrepareMany = Expect<
  Extends<
    { keys: string[]; results: number[]; mode: "many" },
    PrepareLoaderResultManyOptions<string, number, number>
  >
>;
export type _JaroWinkler = Expect<
  Equal<typeof jaroWinklerSimilarity extends (a: string, b: string) => number ? true : false, true>
>;
export type _JaroWinklerDistance = Expect<
  Equal<ReturnType<typeof jaroWinklerDistance>, ReturnType<typeof jaroWinklerSimilarity>>
>;
export type _StreamSourceInstance = Expect<Extends<number[], StreamSourceInstance<number>>>;

// ─── intervals ───────────────────────────────────────────────────────────────

export type _BigValue = Expect<
  Equal<typeof bigDomain extends { compare(a: infer V, b: infer V): number } ? V : never, BigValue>
>;
export type _FractionValue = Expect<
  Equal<
    typeof fractionDomain extends { compare(a: infer V, b: infer V): number } ? V : never,
    FractionValue
  >
>;

// ─── filters ─────────────────────────────────────────────────────────────────

export type _AnyOperator = Expect<Equal<keyof typeof OPERATOR_CODE, AnyOperator>>;
export type _Fragment = Expect<Equal<Fragment, { sql: string; bindings: unknown[] }>>;

// ─── react ───────────────────────────────────────────────────────────────────

export type _UseStreamOptions = Expect<
  Equal<
    UseStreamOptions<number, void, string>,
    | UseStreamAccumulateOptions<number, void>
    | UseStreamLatestOptions<number, void>
    | UseStreamMaxItemsOptions<number, void>
    | UseStreamReducerOptions<number, string, void>
  >
>;
export type _UseStreamBase = Expect<
  Extends<UseStreamLatestOptions<number>, UseStreamBaseOptions<number>>
>;
export type _RenderProp = Expect<Extends<(n: number) => string, RenderProp<number>>>;
export type _RenderPropNoData = Expect<Extends<() => null, RenderPropNoData>>;
export type _UseStreamSource = Expect<
  Extends<StreamSourceWithReturn<number, string>, UseStreamSource<number, string>>
>;
export type _AnyProps = Expect<Equal<AnyProps, Record<string, unknown>>>;

// ─── sonner ──────────────────────────────────────────────────────────────────

export type _ToastStreamReturn = Expect<
  Equal<ReturnType<typeof toastStreamAsync<number, string>>, ToastStreamReturn<number, string>>
>;
export type _StreamResult = Expect<
  Equal<
    Awaited<ReturnType<ToastStreamReturn<number, string>["unwrap"]>>,
    StreamResult<number, string>
  >
>;
export type _ToastStreamData = Expect<Extends<{ loading: "Loading…" }, ToastStreamData<number>>>;

// ─── tanstack ────────────────────────────────────────────────────────────────

export type _QueryStateStore = Expect<Equal<AdapterValue["store"], QueryStateStore>>;
export type _CreateQueryStateStore = Expect<
  Equal<ReturnType<typeof createQueryStateStore>, QueryStateStore>
>;
export type _CommitFn = Expect<
  Equal<Parameters<typeof createQueryStateStore>[0]["commit"], CommitFn>
>;
export type _CommitInput = Expect<Equal<Parameters<CommitFn>[0], CommitInput>>;
export type _Snapshot = Expect<Equal<ReturnType<QueryStateStore["getSnapshot"]>, Snapshot>>;
export type _StoreUpdate = Expect<Equal<Parameters<QueryStateStore["update"]>[0], StoreUpdate>>;
export type _ReadValue = Expect<Equal<ReadValue<undefined>, string | null>>;
export type _Eq = Expect<Equal<Eq<number>, ServerEq<number>>>;
export type _JsonValidator = Expect<Equal<JsonValidator<number>, ServerJsonValidator<number>>>;
export type _SerializerBase = Expect<Equal<SerializerBase, ServerSerializerBase>>;
export type _SerializerBaseShape = Expect<Equal<SerializerBase, string | URL | URLSearchParams>>;
export type _SchemaInput = Expect<Equal<SchemaInput<{}, true>, ServerSchemaInput<{}, true>>>;
export type _Transport = Expect<Equal<Transport, ServerTransport>>;

// ─── unstorage / temporal / web ──────────────────────────────────────────────

export type _CacheMethodDecorator = Expect<Extends<Cache["decorator"], CacheMethodDecorator>>;
export type _CacheMethodDecoratorFactory = Expect<
  Equal<
    ReturnType<Extract<Cache["decorator"], (overrides: never) => unknown>>,
    CacheMethodDecorator
  >
>;
export type _DurationToMsOptions = Expect<
  Equal<Parameters<typeof durationToMs>[1], DurationToMsOptions | undefined>
>;
export type _FetchWithProgressInit = Expect<
  Extends<FetchWithProgressInit, NonNullable<Parameters<typeof fetchWithProgress>[1]>>
>;
