import { describe, expect, test } from "vitest";

import { parseAsInteger, parseAsString } from "../src/tanstack/core/built-in-parsers.ts";
import { planInvalidStrip, planKeyedUpdate } from "../src/tanstack/core/query-states.ts";
import { debounce } from "../src/tanstack/core/rate-limit.ts";

const identity = (key: string): string => key;

describe("planKeyedUpdate (useQueryStates option precedence)", () => {
  test("a parser's .withOptions() reaches the commit options", () => {
    const plan = planKeyedUpdate({
      parsers: { q: parseAsString.withOptions({ history: "push", shallow: false }) },
      urlKeyFor: identity,
      patch: { q: "x" },
    });
    expect(plan.options.history).toBe("push");
    expect(plan.options.shallow).toBe(false);
  });

  test("parser options beat hook options", () => {
    const plan = planKeyedUpdate({
      parsers: { q: parseAsString.withOptions({ limitUrlUpdates: debounce(300) }) },
      urlKeyFor: identity,
      patch: { q: "x" },
      hookOptions: { history: "push", limitUrlUpdates: debounce(10) },
    });
    expect(plan.options.limitUrlUpdates).toEqual(debounce(300));
    expect(plan.options.history).toBe("push");
  });

  test("a per-call clearOnDefault beats the parser's", () => {
    const parsers = { page: parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }) };
    const plan = planKeyedUpdate({
      parsers,
      urlKeyFor: identity,
      patch: { page: 1 },
      callOptions: { clearOnDefault: false },
    });
    expect(plan.apply(new URLSearchParams("page=4")).toString()).toBe("page=1");
  });

  test("parser clearOnDefault beats the hook's, per key", () => {
    const parsers = {
      a: parseAsInteger.withDefault(0).withOptions({ clearOnDefault: false }),
      b: parseAsInteger.withDefault(0),
    };
    const plan = planKeyedUpdate({
      parsers,
      urlKeyFor: identity,
      patch: { a: 0, b: 0 },
      hookOptions: { clearOnDefault: true },
    });
    expect(plan.apply(new URLSearchParams("a=3&b=3")).toString()).toBe("a=0");
  });

  test("call options beat parser options", () => {
    const plan = planKeyedUpdate({
      parsers: { q: parseAsString.withOptions({ history: "push", shallow: false }) },
      urlKeyFor: identity,
      patch: { q: "x" },
      callOptions: { shallow: true },
    });
    expect(plan.options.shallow).toBe(true);
    expect(plan.options.history).toBe("push");
  });

  test("only keys in the patch contribute their parser options", () => {
    const parsers = {
      a: parseAsString.withOptions({ history: "push" }),
      b: parseAsString,
    };
    const plan = planKeyedUpdate({ parsers, urlKeyFor: identity, patch: { b: "x" } });
    expect(plan.options.history).toBe("replace");
  });

  test("touched keys merge loudest-wins; null clears every key", () => {
    const parsers = {
      a: parseAsString.withOptions({ history: "push" }),
      b: parseAsString.withOptions({ shallow: false }),
    };
    const plan = planKeyedUpdate({
      parsers,
      urlKeyFor: (key) => (key === "a" ? "x" : key),
      patch: null,
    });
    expect(plan.options.history).toBe("push");
    expect(plan.options.shallow).toBe(false);
    expect(plan.apply(new URLSearchParams("x=1&b=2&keep=3")).toString()).toBe("keep=3");
  });

  test("an empty patch falls back to call > hook > adapter", () => {
    const plan = planKeyedUpdate({
      parsers: { q: parseAsString },
      urlKeyFor: identity,
      patch: {},
      hookOptions: { scroll: true },
      adapterDefaults: { history: "push" },
    });
    expect(plan.options.scroll).toBe(true);
    expect(plan.options.history).toBe("push");
  });
});

describe("planInvalidStrip (useQueryStates clearOnInvalid)", () => {
  const params = new URLSearchParams("a=x&b=y&ok=1");

  test("strips invalid keys by default", () => {
    const plan = planInvalidStrip({
      parsers: { a: parseAsInteger, b: parseAsInteger, ok: parseAsInteger },
      urlKeyFor: identity,
      params,
    });
    expect(plan?.urlKeys).toEqual(["a", "b"]);
  });

  test("a parser's clearOnInvalid: false keeps its key", () => {
    const plan = planInvalidStrip({
      parsers: { a: parseAsInteger.withOptions({ clearOnInvalid: false }), b: parseAsInteger },
      urlKeyFor: identity,
      params,
    });
    expect(plan?.urlKeys).toEqual(["b"]);
  });

  test("a parser's clearOnInvalid: true beats the hook's false", () => {
    const plan = planInvalidStrip({
      parsers: { a: parseAsInteger.withOptions({ clearOnInvalid: true }), b: parseAsInteger },
      urlKeyFor: identity,
      params,
      hookOptions: { clearOnInvalid: false },
    });
    expect(plan?.urlKeys).toEqual(["a"]);
  });

  test("null when nothing to strip", () => {
    const plan = planInvalidStrip({
      parsers: { ok: parseAsInteger },
      urlKeyFor: identity,
      params,
    });
    expect(plan).toBeNull();
  });
});
