import type { inferParserMapType, ParserMap } from "./parser.ts";

import { readKey } from "./urlsearchparams.ts";

/**
 * Vendored Standard Schema v1 interface (https://standardschema.dev), so we
 * don't take a dependency just for the ~30-line contract. Compatible with
 * Zod/Valibot/ArkType validators and with TanStack Router `validateSearch`.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output>;
  }
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
  }
  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
}

/**
 * Run a Standard Schema synchronously, returning its output or throwing.
 * Async validators are unsupported (matches nuqs `parseAsJson`).
 */
export function validateWithStandardSchema<T>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown,
): T {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) {
    throw new TypeError("Async validation is not supported in query parsers.");
  }
  if (result.issues) {
    throw new Error(result.issues.map((issue) => issue.message).join("; ") || "Invalid value");
  }
  return result.value;
}

function stringifyScalar(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export type CreateStandardSchemaOptions<M extends ParserMap> = {
  /** Allow callers (e.g. `<Link search>`) to pass a subset of keys. */
  partialOutput?: boolean;
  /** Map logical parser keys to the URL keys they read from. */
  urlKeys?: Partial<Record<keyof M, string>>;
};

type SchemaInput<M extends ParserMap, Partial_ extends boolean> = Partial_ extends true
  ? Partial<inferParserMapType<M>>
  : inferParserMapType<M>;

/**
 * Build a Standard Schema from a parser map for use in a route's
 * `validateSearch`. The same parser definitions a component uses with
 * `useQueryStates` can validate/type the route — without the component
 * importing the route object.
 */
export function createStandardSchemaV1<
  M extends ParserMap,
  const Opts extends CreateStandardSchemaOptions<M> = CreateStandardSchemaOptions<M>,
>(
  parsers: M,
  options?: Opts,
): StandardSchemaV1<
  SchemaInput<M, Opts["partialOutput"] extends true ? true : false>,
  inferParserMapType<M>
> {
  const urlKeyFor = (key: string): string => {
    const mapped = options?.urlKeys?.[key];
    return typeof mapped === "string" ? mapped : key;
  };
  return {
    "~standard": {
      version: 1,
      vendor: "xantiagoma/tanstack",
      validate: (value) => {
        if (typeof value !== "object" || value === null) {
          return { issues: [{ message: "Expected a search params object" }] };
        }
        const params = new URLSearchParams();
        for (const key of Object.keys(parsers)) {
          const urlKey = urlKeyFor(key);
          const raw: unknown = Reflect.get(value, urlKey);
          if (raw === undefined || raw === null) continue;
          if (Array.isArray(raw)) {
            for (const part of raw) params.append(urlKey, stringifyScalar(part));
          } else {
            params.set(urlKey, stringifyScalar(raw));
          }
        }
        const result: Record<string, unknown> = {};
        for (const [key, parser] of Object.entries(parsers)) {
          result[key] = readKey(params, urlKeyFor(key), parser);
        }
        // Boundary cast: `result` is built dynamically from the parser map,
        // which by construction yields `inferParserMapType<M>`.
        return { value: result as inferParserMapType<M> };
      },
    },
  };
}
