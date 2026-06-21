import { describe, expect, test } from "vitest";
import { isPromise } from "../src/is-promise.ts";

import type { FieldOption } from "../src/filters/resource-metadata.ts";
import { type FieldOptions, resolveFieldOptions } from "../src/filters/resource-options.ts";

const list: FieldOption[] = [
  { value: "todo", label: "To do" },
  { value: "done", label: "Done" },
];

describe("resolveFieldOptions — sync/async-adaptive", () => {
  test("static list resolves synchronously (no microtask)", () => {
    const out = resolveFieldOptions({ options: list });
    expect(isPromise(out)).toBe(false);
    expect(out).toBe(list);
  });

  test("sync getter resolves synchronously and receives the query", () => {
    const seen: unknown[] = [];
    const options: FieldOptions = (query) => {
      seen.push(query);

      return list;
    };
    const out = resolveFieldOptions({ options, query: { q: "to" } });
    expect(isPromise(out)).toBe(false);
    expect(out).toEqual(list);
    expect(seen).toEqual([{ q: "to" }]);
  });

  test("async getter yields a Promise resolving to the options", async () => {
    const options: FieldOptions = async ({ ids }) =>
      list.filter((o) => !ids || ids.includes(o.value));
    const out = resolveFieldOptions({ options, query: { ids: ["done"] } });
    expect(isPromise(out)).toBe(true);
    expect(await out).toEqual([{ value: "done", label: "Done" }]);
  });

  test("getter with no query gets an empty object", () => {
    let received: unknown;
    resolveFieldOptions({
      options: (query) => {
        received = query;

        return [];
      },
    });
    expect(received).toEqual({});
  });
});
