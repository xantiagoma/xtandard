import { describe, expect, test } from "vitest";

import { range, rangeLazy } from "../src/range";

describe("rangeLazy", () => {
  test("end only", () => {
    expect([...rangeLazy(5)]).toEqual([0, 1, 2, 3, 4]);
  });

  test("start and end", () => {
    expect([...rangeLazy(2, 5)]).toEqual([2, 3, 4]);
  });

  test("with step", () => {
    expect([...rangeLazy(0, 10, { step: 3 })]).toEqual([0, 3, 6, 9]);
  });

  test("descending", () => {
    expect([...rangeLazy(0, 5, { direction: "desc" })]).toEqual([4, 3, 2, 1, 0]);
  });

  test("descending with step", () => {
    expect([...rangeLazy(2, 10, { step: 3, direction: "desc" })]).toEqual([9, 6, 3]);
  });

  test("empty range", () => {
    expect([...rangeLazy(0)]).toEqual([]);
  });

  test("single element", () => {
    expect([...rangeLazy(1)]).toEqual([0]);
  });
});

describe("range", () => {
  test("returns array", () => {
    expect(range(3)).toEqual([0, 1, 2]);
  });

  test("start and end", () => {
    expect(range(2, 5)).toEqual([2, 3, 4]);
  });

  test("with step", () => {
    expect(range(0, 10, { step: 2 })).toEqual([0, 2, 4, 6, 8]);
  });

  test("descending", () => {
    expect(range(0, 5, { direction: "desc" })).toEqual([4, 3, 2, 1, 0]);
  });
});
