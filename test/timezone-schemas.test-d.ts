/**
 * Every validator's `TimeZoneSchema` must validate into the SAME canonical
 * `TimeZone` brand (`src/timezone.ts`). Checked by `tsc --noEmit`.
 */
import type { Equal, Expect } from "type-testing";

import type { TimeZone } from "../src/timezone.ts";

import type * as v from "valibot";
import type { TimeZoneSchema as ValibotTimeZone } from "../src/valibot-utils.ts";
export type _ValibotTz = Expect<Equal<v.InferOutput<typeof ValibotTimeZone>, TimeZone>>;

import type { z } from "zod";
import type { TimeZoneSchema as ZodTimeZone } from "../src/zod-utils.ts";
export type _ZodTz = Expect<Equal<z.infer<typeof ZodTimeZone>, TimeZone>>;

import type { Schema } from "effect";
import type { TimeZoneSchema as EffectTimeZone } from "../src/effect-utils.ts";
export type _EffectTz = Expect<Equal<Schema.Schema.Type<typeof EffectTimeZone>, TimeZone>>;

import type { TimeZoneSchema as ArkTimeZone } from "../src/arktype-utils.ts";
export type _ArkTz = Expect<Equal<(typeof ArkTimeZone)["infer"], TimeZone>>;
