import { describe, expect, test } from "vitest";

import * as valibot from "../src/valibot-utils.ts";
import * as zod from "../src/zod-utils.ts";
import * as ark from "../src/arktype-utils.ts";
import * as effect from "../src/effect-utils.ts";

const ok = "America/Los_Angeles";
const bad = "Not/AZone";

describe("TimeZoneSchema accepts valid IANA + rejects invalid (every validator)", () => {
  test("valibot", () => {
    expect(valibot.parseTimeZone(ok)).toBe(ok);
    expect(() => valibot.parseTimeZone(bad)).toThrow();
  });

  test("zod", () => {
    expect(zod.parseTimeZone(ok)).toBe(ok);
    expect(() => zod.parseTimeZone(bad)).toThrow();
  });

  test("arktype", () => {
    expect(ark.parseTimeZone(ok)).toBe(ok);
    expect(() => ark.parseTimeZone(bad)).toThrow();
  });

  test("effect", () => {
    expect(effect.parseTimeZone(ok)).toBe(ok);
    expect(() => effect.parseTimeZone(bad)).toThrow();
  });

  test("isValidTimeZone is shared + dependency-free", () => {
    expect(valibot.isValidTimeZone({ timeZone: ok }).valid).toBe(true);
    expect(valibot.isValidTimeZone({ timeZone: bad }).valid).toBe(false);
  });
});
