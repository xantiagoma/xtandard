import { describe, expect, test } from "vitest";

import { formDataToObject } from "../src/form-data-to-object-utils";

describe("formDataToObject", () => {
  test("converts single values", () => {
    const fd = new FormData();
    fd.append("name", "John");
    fd.append("age", "30");
    const result = formDataToObject<{ name: string; age: string }>(fd);
    expect(result).toEqual({ name: "John", age: "30" });
  });

  test("converts duplicate keys to arrays", () => {
    const fd = new FormData();
    fd.append("tag", "a");
    fd.append("tag", "b");
    fd.append("tag", "c");
    const result = formDataToObject<{ tag: string[] }>(fd);
    expect(result).toEqual({ tag: ["a", "b", "c"] });
  });

  test("empty form data", () => {
    const result = formDataToObject(new FormData());
    expect(Object.keys(result)).toHaveLength(0);
  });

  test("mixed single and multi values", () => {
    const fd = new FormData();
    fd.append("name", "John");
    fd.append("hobby", "code");
    fd.append("hobby", "music");
    const result = formDataToObject<{ name: string; hobby: string[] }>(fd);
    expect(result).toEqual({ name: "John", hobby: ["code", "music"] });
  });
});
