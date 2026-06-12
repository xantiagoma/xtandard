import { describe, expect, test } from "vitest";
import { fromRelayArgs, parsePaginationParams } from "../src/pagination-params.ts";

describe("parsePaginationParams", () => {
  test("parses page style from URLSearchParams", () => {
    expect(parsePaginationParams(new URLSearchParams("page=3&page_size=25"))).toEqual({
      type: "page",
      page: 3,
      pageSize: 25,
    });
  });

  test("supports page-size aliases", () => {
    for (const alias of ["page_size", "pageSize", "per_page", "perPage", "size"]) {
      const input = parsePaginationParams(new URLSearchParams(`page=1&${alias}=7`));
      expect(input).toEqual({ type: "page", page: 1, pageSize: 7 });
    }
  });

  test("parses offset style, including take/skip aliases", () => {
    expect(parsePaginationParams(new URLSearchParams("limit=10&offset=40"))).toEqual({
      type: "offset",
      limit: 10,
      offset: 40,
    });
    expect(parsePaginationParams(new URLSearchParams("take=10&skip=40"))).toEqual({
      type: "offset",
      limit: 10,
      offset: 40,
    });
  });

  test("parses cursor style", () => {
    expect(parsePaginationParams(new URLSearchParams("cursor=abc&limit=15"))).toEqual({
      type: "cursor",
      limit: 15,
      cursor: "abc",
      direction: "forward",
    });
  });

  test("before/after params imply direction", () => {
    expect(parsePaginationParams(new URLSearchParams("after=abc"))).toMatchObject({
      type: "cursor",
      cursor: "abc",
      direction: "forward",
    });
    expect(parsePaginationParams(new URLSearchParams("before=xyz"))).toMatchObject({
      type: "cursor",
      cursor: "xyz",
      direction: "backward",
    });
  });

  test("explicit direction param", () => {
    expect(
      parsePaginationParams(new URLSearchParams("cursor=abc&direction=backward")),
    ).toMatchObject({ direction: "backward" });
  });

  test("cursor takes precedence over offset and page", () => {
    const input = parsePaginationParams(new URLSearchParams("cursor=abc&page=3&offset=10"));
    expect(input.type).toBe("cursor");
  });

  test("accepts plain record sources", () => {
    expect(parsePaginationParams({ page: "2", per_page: "10" })).toEqual({
      type: "page",
      page: 2,
      pageSize: 10,
    });
    expect(parsePaginationParams({ page: 2, per_page: 10 })).toEqual({
      type: "page",
      page: 2,
      pageSize: 10,
    });
    expect(parsePaginationParams({ page: ["4"], size: ["5", "9"] })).toEqual({
      type: "page",
      page: 4,
      pageSize: 5,
    });
  });

  test("clamps untrusted sizes and pages", () => {
    expect(parsePaginationParams(new URLSearchParams("page=0&page_size=99999"))).toEqual({
      type: "page",
      page: 1,
      pageSize: 100,
    });
    expect(
      parsePaginationParams(new URLSearchParams("page_size=99999"), { maxPageSize: 500 }),
    ).toMatchObject({ pageSize: 500 });
    expect(parsePaginationParams(new URLSearchParams("offset=-5&limit=10"))).toMatchObject({
      offset: 0,
    });
  });

  test("falls back to defaults when nothing is present", () => {
    expect(parsePaginationParams(new URLSearchParams())).toEqual({
      type: "page",
      page: 1,
      pageSize: 20,
    });
    expect(parsePaginationParams({}, { fallback: "cursor", defaultPageSize: 50 })).toEqual({
      type: "cursor",
      limit: 50,
      direction: "forward",
    });
    expect(parsePaginationParams({}, { fallback: "offset" })).toEqual({
      type: "offset",
      limit: 20,
      offset: 0,
    });
  });

  test("ignores empty and malformed values", () => {
    expect(parsePaginationParams(new URLSearchParams("page=abc&page_size="))).toEqual({
      type: "page",
      page: 1,
      pageSize: 20,
    });
  });
});

describe("fromRelayArgs", () => {
  test("first/after paginate forward", () => {
    expect(fromRelayArgs({ first: 10, after: "abc" })).toEqual({
      type: "cursor",
      limit: 10,
      cursor: "abc",
      direction: "forward",
    });
  });

  test("last/before paginate backward", () => {
    expect(fromRelayArgs({ last: 5, before: "xyz" })).toEqual({
      type: "cursor",
      limit: 5,
      cursor: "xyz",
      direction: "backward",
    });
  });

  test("before without last still paginates backward with default size", () => {
    expect(fromRelayArgs({ before: "xyz" })).toEqual({
      type: "cursor",
      limit: 20,
      cursor: "xyz",
      direction: "backward",
    });
  });

  test("last without before paginates backward from the end", () => {
    expect(fromRelayArgs({ last: 5 })).toEqual({
      type: "cursor",
      limit: 5,
      cursor: undefined,
      direction: "backward",
    });
  });

  test("empty args paginate forward from the start", () => {
    expect(fromRelayArgs({})).toEqual({ type: "cursor", limit: 20, direction: "forward" });
  });

  test("clamps limits", () => {
    expect(fromRelayArgs({ first: 9999 })).toMatchObject({ limit: 100 });
    expect(fromRelayArgs({ first: 9999 }, { maxPageSize: 1000 })).toMatchObject({ limit: 1000 });
  });
});
