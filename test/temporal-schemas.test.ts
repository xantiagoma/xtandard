import { describe, expect, test } from "vitest";
import * as v from "valibot";

import { isValidTimeZone } from "../src/valibot-utils.ts";
import {
  DurationSchema,
  InstantSchema,
  PlainDateSchema,
  PlainDateTimeSchema,
  PlainTimeSchema,
  ZonedDateTimeSchema,
} from "../src/temporal-schemas.ts";
import * as valibotEntry from "../src/entry-valibot.ts";

const cases = [
  { name: "Instant", schema: InstantSchema, ok: "2026-06-18T16:00:00Z" },
  { name: "PlainDate", schema: PlainDateSchema, ok: "2026-12-25" },
  { name: "PlainTime", schema: PlainTimeSchema, ok: "09:00:00" },
  { name: "PlainDateTime", schema: PlainDateTimeSchema, ok: "2026-12-25T09:00:00" },
  {
    name: "ZonedDateTime",
    schema: ZonedDateTimeSchema,
    ok: "2026-06-18T09:00:00-07:00[America/Los_Angeles]",
  },
  { name: "Duration", schema: DurationSchema, ok: "PT30M" },
] as const;

describe("temporal kind schemas (xantiagoma/valibot)", () => {
  for (const { name, schema, ok } of cases) {
    test(`${name}: a valid string parses to its canonical form; garbage throws`, () => {
      expect(v.parse(schema, ok)).toBe(ok);
      expect(() => v.parse(schema, "not-a-temporal-value")).toThrow();
    });
  }

  test("isValidTimeZone (Intl-checked)", () => {
    expect(isValidTimeZone({ timeZone: "America/Los_Angeles" }).valid).toBe(true);
    expect(isValidTimeZone({ timeZone: "UTC" }).valid).toBe(true);
    expect(isValidTimeZone({ timeZone: "Not/AZone" }).valid).toBe(false);
  });

  test("the xantiagoma/valibot entry re-exports them", () => {
    expect(valibotEntry.InstantSchema).toBe(InstantSchema);
    expect(valibotEntry.isValidTimeZone).toBe(isValidTimeZone);
  });
});
