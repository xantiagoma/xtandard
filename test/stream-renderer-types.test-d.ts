/**
 * Compile-time inference assertions for `useStream` / `StreamRenderer`
 * (`@xtandard/lib/react`). Statically type-checked by `tsc --noEmit`, not run.
 */
import type { Equal, Expect } from "type-testing";

import { AsyncChannel } from "../src/index.ts";
import { StreamRenderer, type StreamRendererProps, useStream } from "../src/stream-renderer.tsx";

type Summary = { asked: number; answered: number };

async function* quotes(): AsyncGenerator<string, Summary> {
  yield "acme";
  return { asked: 1, answered: 1 };
}
function* syncSteps(): Generator<number, string> {
  yield 1;
  return "done";
}
const channel = () => AsyncChannel.create<number, boolean>();

// Hooks are only type-checked here, never called.
const check = () => {
  // --- returnValue is inferred from the source's return type ---------------
  const asyncFactory = useStream({ source: quotes, queryKey: ["q"] });
  const asyncInstance = useStream({ source: quotes(), queryKey: ["q"] });
  const syncFactory = useStream({ source: syncSteps, queryKey: ["s"], mode: "latest" });
  const fromChannel = useStream({ source: channel, queryKey: ["c"], maxItems: 5 });
  const inline = useStream({ source: () => quotes(), queryKey: ["q"] });

  // --- sources without a return value keep the old default ---------------
  const fromArray = useStream({ source: [1, 2, 3], queryKey: ["a"] });

  // --- explicit type arguments still work (and win) ------------------------
  const explicit = useStream<string, Summary>({ source: quotes, queryKey: ["q"] });
  const itemOnly = useStream<string>({ source: quotes, queryKey: ["q"] });

  // --- onSuccess sees the inferred return type ----------------------------
  useStream({
    source: quotes,
    queryKey: ["q"],
    onSuccess: ({ returnValue }) => {
      const _r: Summary | undefined = returnValue;
    },
  });

  // --- reducer overload: TState from initialState, TYield from the source --
  const reduced = useStream({
    source: quotes,
    queryKey: ["r"],
    reducer: (acc: string[], item) => [...acc, item],
    initialState: [] as string[],
  });

  return {
    asyncFactory,
    asyncInstance,
    syncFactory,
    fromChannel,
    inline,
    fromArray,
    explicit,
    itemOnly,
    reduced,
  };
};

type R = ReturnType<typeof check>;

export type _AsyncFactory = Expect<Equal<R["asyncFactory"]["returnValue"], Summary | undefined>>;
export type _AsyncFactoryItems = Expect<Equal<R["asyncFactory"]["items"], string[]>>;
export type _AsyncInstance = Expect<Equal<R["asyncInstance"]["returnValue"], Summary | undefined>>;
export type _SyncFactory = Expect<Equal<R["syncFactory"]["returnValue"], string | undefined>>;
export type _SyncFactoryItems = Expect<Equal<R["syncFactory"]["items"], number[]>>;
export type _Channel = Expect<Equal<R["fromChannel"]["returnValue"], boolean | undefined>>;
export type _Inline = Expect<Equal<R["inline"]["returnValue"], Summary | undefined>>;
export type _Array = Expect<Equal<R["fromArray"]["returnValue"], void | undefined>>;
export type _ArrayItems = Expect<Equal<R["fromArray"]["items"], number[]>>;
export type _Explicit = Expect<Equal<R["explicit"]["returnValue"], Summary | undefined>>;
export type _ItemOnly = Expect<Equal<R["itemOnly"]["returnValue"], void | undefined>>;
export type _Reduced = Expect<Equal<R["reduced"]["state"], string[]>>;

// --- StreamRenderer infers TReturn from `source` as well --------------------

// `returnValue?.answered` only compiles if `returnValue` is `Summary | undefined`.
export const _renderer = () =>
  StreamRenderer({ source: quotes, success: ({ returnValue }) => returnValue?.answered });

const props = <Y, Ret = void>(p: StreamRendererProps<Y, Ret>) => p;
const rendererProps = props({ source: syncSteps, success: ({ returnValue }) => returnValue });
export type _RendererInfers = Expect<
  Equal<typeof rendererProps, StreamRendererProps<number, string>>
>;
