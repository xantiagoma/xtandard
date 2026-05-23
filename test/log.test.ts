import { describe, expect, test } from "vitest";

import { log } from "../src/log";

describe("log", () => {
  test("returns undefined with no args", () => {
    expect(log()).toBeUndefined();
  });

  test("returns single value", () => {
    expect(log(42)).toBe(42);
  });

  test("returns tuple for multiple args", () => {
    expect(log(1, "a")).toEqual([1, "a"]);
  });

  test("returns object", () => {
    const obj = { v: "hello" };
    expect(log(obj)).toBe(obj);
  });
});
