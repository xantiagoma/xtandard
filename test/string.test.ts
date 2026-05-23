import { describe, expect, test } from "vitest";

import { ensureString, jaroWinklerDistance, naturalSortCompare } from "../src/string";

describe("ensureString", () => {
  test("string passthrough", () => expect(ensureString("hello")).toBe("hello"));
  test("empty string", () => expect(ensureString("")).toBe(""));
  test("array returns first element", () => expect(ensureString(["a", "b"])).toBe("a"));
  test("single element array", () => expect(ensureString(["only"])).toBe("only"));
  test("empty array returns undefined", () => expect(ensureString([])).toBeUndefined());
  test("null returns undefined", () => expect(ensureString(null)).toBeUndefined());
  test("undefined returns undefined", () => expect(ensureString(undefined)).toBeUndefined());
  test("no argument returns undefined", () => expect(ensureString()).toBeUndefined());
});

describe("naturalSortCompare", () => {
  test("sorts numbers within strings numerically", () => {
    const sorted = ["file10", "file2", "file1", "file20"].sort(naturalSortCompare);
    expect(sorted).toEqual(["file1", "file2", "file10", "file20"]);
  });

  test("case insensitive", () => {
    const sorted = ["Banana", "apple", "Cherry"].sort(naturalSortCompare);
    expect(sorted).toEqual(["apple", "Banana", "Cherry"]);
  });

  test("plain alphabetical", () => {
    const sorted = ["c", "a", "b"].sort(naturalSortCompare);
    expect(sorted).toEqual(["a", "b", "c"]);
  });

  test("mixed text and numbers", () => {
    const sorted = ["item1b", "item1a", "item2", "item10"].sort(naturalSortCompare);
    expect(sorted).toEqual(["item1a", "item1b", "item2", "item10"]);
  });

  test("equal strings", () => {
    expect(naturalSortCompare("abc", "abc")).toBe(0);
  });

  test("empty strings", () => {
    expect(naturalSortCompare("", "")).toBe(0);
  });
});

describe("jaroWinklerDistance", () => {
  describe("basic", () => {
    test("identical strings return 1", () => {
      expect(jaroWinklerDistance("hello", "hello")).toBe(1);
    });

    test("empty a returns 0", () => {
      expect(jaroWinklerDistance("", "hello")).toBe(0);
    });

    test("empty b returns 0", () => {
      expect(jaroWinklerDistance("hello", "")).toBe(0);
    });

    test("both empty returns 0", () => {
      expect(jaroWinklerDistance("", "")).toBe(0);
    });

    test("completely different strings return 0", () => {
      expect(jaroWinklerDistance("abc", "xyz")).toBe(0);
    });
  });

  describe("similarity scores", () => {
    test("martha vs marhta (classic example)", () => {
      const score = jaroWinklerDistance("martha", "marhta");
      expect(score).toBeGreaterThan(0.96);
      expect(score).toBeLessThan(0.97);
    });

    test("similar strings score high", () => {
      expect(jaroWinklerDistance("dwayne", "duane")).toBeGreaterThan(0.8);
    });

    test("somewhat similar strings", () => {
      const score = jaroWinklerDistance("dixon", "dicksonx");
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThan(0.9);
    });

    test("score is between 0 and 1", () => {
      const score = jaroWinklerDistance("hello", "world");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("case sensitivity", () => {
    test("case insensitive by default", () => {
      expect(jaroWinklerDistance("hello", "HELLO")).toBe(1);
    });

    test("case sensitive when specified", () => {
      expect(jaroWinklerDistance("hello", "HELLO", { caseSensitive: true })).toBe(0);
    });

    test("mixed case insensitive", () => {
      expect(jaroWinklerDistance("Martha", "MARHTA")).toBeGreaterThan(0.96);
    });
  });

  describe("symmetry", () => {
    test("order does not matter", () => {
      const ab = jaroWinklerDistance("abc", "abd");
      const ba = jaroWinklerDistance("abd", "abc");
      expect(ab).toBeCloseTo(ba, 10);
    });
  });

  describe("winkler prefix bonus", () => {
    test("common prefix boosts score above 0.7", () => {
      const withPrefix = jaroWinklerDistance("prefix_abc", "prefix_xyz");
      const noPrefix = jaroWinklerDistance("abc_prefix", "xyz_prefix");
      expect(withPrefix).toBeGreaterThan(noPrefix);
    });
  });
});
