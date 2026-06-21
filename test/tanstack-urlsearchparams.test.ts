import { describe, expect, test } from "vitest";

import {
  parseAsInteger,
  parseAsNativeArrayOf,
  parseAsString,
} from "../src/tanstack/core/built-in-parsers.ts";
import {
  hasInvalidKey,
  keepSubDelims,
  keyToken,
  readKey,
  toSearchParams,
  writeKey,
} from "../src/tanstack/core/urlsearchparams.ts";

describe("readKey", () => {
  test("reads and parses a present key", () => {
    expect(readKey(new URLSearchParams("name=foo"), "name", parseAsString)).toBe("foo");
  });

  test("missing key without default → null", () => {
    expect(readKey(new URLSearchParams(""), "name", parseAsString)).toBeNull();
  });

  test("missing key with default → default", () => {
    expect(readKey(new URLSearchParams(""), "page", parseAsInteger.withDefault(1))).toBe(1);
  });

  test("invalid value with default → default", () => {
    expect(readKey(new URLSearchParams("page=x"), "page", parseAsInteger.withDefault(1))).toBe(1);
  });

  test("multi parser reads repeated keys", () => {
    expect(
      readKey(new URLSearchParams("tag=a&tag=b"), "tag", parseAsNativeArrayOf(parseAsString)),
    ).toEqual(["a", "b"]);
  });

  test("multi parser absent → [] default", () => {
    expect(readKey(new URLSearchParams(""), "tag", parseAsNativeArrayOf(parseAsString))).toEqual(
      [],
    );
  });
});

describe("writeKey", () => {
  test("writes a value", () => {
    const params = new URLSearchParams();
    writeKey(params, "name", parseAsString, "foo", true);
    expect(params.toString()).toBe("name=foo");
  });

  test("null removes the key", () => {
    const params = new URLSearchParams("name=foo&other=1");
    writeKey(params, "name", parseAsString, null, true);
    expect(params.toString()).toBe("other=1");
  });

  test("empty string serializes as name=", () => {
    const params = new URLSearchParams();
    writeKey(params, "name", parseAsString, "", true);
    expect(params.toString()).toBe("name=");
  });

  test("clearOnDefault removes a key equal to default", () => {
    const params = new URLSearchParams("page=5");
    writeKey(params, "page", parseAsInteger.withDefault(0), 0, true);
    expect(params.has("page")).toBe(false);
  });

  test("clearOnDefault off keeps a key equal to default", () => {
    const params = new URLSearchParams();
    writeKey(params, "page", parseAsInteger.withDefault(0), 0, false);
    expect(params.get("page")).toBe("0");
  });

  test("multi parser writes repeated keys and clears prior", () => {
    const params = new URLSearchParams("tag=old");
    writeKey(params, "tag", parseAsNativeArrayOf(parseAsString), ["a", "b"], false);
    expect(params.getAll("tag")).toEqual(["a", "b"]);
  });

  test("preserves unrelated keys", () => {
    const params = new URLSearchParams("a=1&b=2");
    writeKey(params, "a", parseAsString, "9", true);
    expect(params.get("b")).toBe("2");
  });
});

describe("hasInvalidKey", () => {
  test("present and valid → false", () => {
    expect(hasInvalidKey(new URLSearchParams("page=3"), "page", parseAsInteger)).toBe(false);
  });

  test("present but invalid → true", () => {
    expect(hasInvalidKey(new URLSearchParams("page=abc"), "page", parseAsInteger)).toBe(true);
  });

  test("absent key → false (not invalid, just defaulted)", () => {
    expect(hasInvalidKey(new URLSearchParams(""), "page", parseAsInteger)).toBe(false);
  });

  test("multi present and valid → false", () => {
    expect(
      hasInvalidKey(new URLSearchParams("tag=a&tag=b"), "tag", parseAsNativeArrayOf(parseAsString)),
    ).toBe(false);
  });

  test("multi absent → false", () => {
    expect(hasInvalidKey(new URLSearchParams(""), "tag", parseAsNativeArrayOf(parseAsString))).toBe(
      false,
    );
  });
});

describe("keyToken", () => {
  test("single token is the raw value or null", () => {
    expect(keyToken(new URLSearchParams("a=1"), "a", "single")).toBe("1");
    expect(keyToken(new URLSearchParams(""), "a", "single")).toBeNull();
  });

  test("multi token is stable JSON of all values", () => {
    expect(keyToken(new URLSearchParams("t=a&t=b"), "t", "multi")).toBe('["a","b"]');
    expect(keyToken(new URLSearchParams(""), "t", "multi")).toBeNull();
  });
});

describe("keepSubDelims", () => {
  test("leaves ( ) , : ! ' raw and round-trips through URLSearchParams", () => {
    const params = new URLSearchParams();
    const rison = "(type:and,nodes:!((field:priority,filter:(kind:number,operator:eq,value:0))))";
    params.set("where", rison);
    const search = keepSubDelims(params);

    expect(search).toBe(`where=${rison}`);
    expect(search).not.toContain("%");
    expect(new URLSearchParams(search).get("where")).toBe(rison);
  });

  test("still percent-encodes &, =, + so separators survive", () => {
    const params = new URLSearchParams();
    params.set("q", "a&b=c+d");
    const search = keepSubDelims(params);

    expect(search).not.toBe("q=a&b=c+d");
    expect(new URLSearchParams(search).get("q")).toBe("a&b=c+d");
  });

  test("preserves multiple keys", () => {
    const params = new URLSearchParams();
    params.set("where", "(a:1)");
    params.set("page", "2");
    const search = keepSubDelims(params);

    expect(new URLSearchParams(search).get("where")).toBe("(a:1)");
    expect(new URLSearchParams(search).get("page")).toBe("2");
  });
});

describe("toSearchParams", () => {
  test("from query string with leading ?", () => {
    expect(toSearchParams("?a=1&b=2").get("a")).toBe("1");
  });
  test("from record with arrays", () => {
    const params = toSearchParams({ a: "1", tags: ["x", "y"], skip: undefined });
    expect(params.get("a")).toBe("1");
    expect(params.getAll("tags")).toEqual(["x", "y"]);
    expect(params.has("skip")).toBe(false);
  });
});
