import type { MaybePromise } from "./types";

/**
 * Map a batch of DB results back to the original keys in order.
 *
 * DataLoader requires the results array to be in the same order as the keys.
 * This utility handles the common pattern of: query returns unordered rows →
 * map each row to its key → return results aligned with the original key order.
 *
 * Supports:
 * - One-to-one (default): one result per key
 * - One-to-many (`mode: "many"`): multiple results per key (returns arrays)
 * - Async `mapValue`: transform rows with async operations
 * - Custom `defaultValue`: fallback for missing keys (instead of undefined)
 * - Composite keys via `keyToString`
 *
 * @example Basic (rows have `id` or `uid`)
 * ```ts
 * const loader = createLoader<User | undefined, Ctx>(async ({ keys }) => {
 *   const rows = await db.users.findMany({ where: { id: { in: [...keys] } } });
 *   return prepareLoaderResult({ keys, results: rows });
 * });
 * ```
 *
 * @example One-to-many
 * ```ts
 * return prepareLoaderResult({
 *   keys,
 *   results: rows,
 *   mode: "many",
 *   getKey: (row) => row.userId,
 * });
 * // Returns: [Photo[], Photo[], ...] — one array per key
 * ```
 *
 * @example With async mapValue
 * ```ts
 * return prepareLoaderResult({
 *   keys,
 *   results: rows,
 *   mapValue: async (row) => ({
 *     ...row,
 *     permissions: await loadPermissions({ context, id: row.roleId }),
 *   }),
 * });
 * ```
 *
 * @example With defaultValue
 * ```ts
 * return prepareLoaderResult({
 *   keys,
 *   results: rows,
 *   defaultValue: null,
 * });
 * // Missing keys return null instead of undefined
 * ```
 */

// ─── One-to-one ────────────────────────────────────────────

interface PrepareLoaderResultOneOptions<TKey, TDBResult, TFinalResult, TDefault> {
  keys: readonly TKey[];
  results: TDBResult[];
  mode?: "one";
  getKey?: (row: TDBResult) => TKey;
  mapValue?: (row: TDBResult) => MaybePromise<TFinalResult>;
  keyToString?: (key: TKey) => string;
  defaultValue?: TDefault;
}

// ─── One-to-many ───────────────────────────────────────────

interface PrepareLoaderResultManyOptions<TKey, TDBResult, TFinalResult> {
  keys: readonly TKey[];
  results: TDBResult[];
  mode: "many";
  getKey?: (row: TDBResult) => TKey;
  mapValue?: (row: TDBResult) => MaybePromise<TFinalResult>;
  keyToString?: (key: TKey) => string;
}

// ─── Overloads ─────────────────────────────────────────────

export function prepareLoaderResult<TKey, TDBResult, TFinalResult = TDBResult>(
  options: PrepareLoaderResultManyOptions<TKey, TDBResult, TFinalResult>,
): Promise<TFinalResult[][]>;

export function prepareLoaderResult<
  TKey,
  TDBResult,
  TFinalResult = TDBResult,
  TDefault = undefined,
>(
  options: PrepareLoaderResultOneOptions<TKey, TDBResult, TFinalResult, TDefault>,
): Promise<(TFinalResult | TDefault)[]>;

// ─── Implementation ────────────────────────────────────────

export async function prepareLoaderResult<
  TKey,
  TDBResult,
  TFinalResult = TDBResult,
  TDefault = undefined,
>({
  keys,
  results,
  mode = "one",
  getKey,
  mapValue,
  keyToString,
  defaultValue,
}: {
  keys: readonly TKey[];
  results: TDBResult[];
  mode?: "one" | "many";
  getKey?: (row: TDBResult) => TKey;
  mapValue?: (row: TDBResult) => MaybePromise<TFinalResult>;
  keyToString?: (key: TKey) => string;
  defaultValue?: TDefault;
}): Promise<(TFinalResult | TDefault | TFinalResult[])[]> {
  const getKeyFn =
    getKey ??
    ((row: TDBResult) => {
      const record = row as Record<string, unknown>;
      if ("id" in record && record.id != null) return record.id as TKey;
      if ("uid" in record && record.uid != null) return record.uid as TKey;
      throw new Error(
        "Unable to find row key. Select 'id' or 'uid', or provide a custom getKey function.",
      );
    });

  const mapValueFn = mapValue ?? ((row: TDBResult) => row as unknown as TFinalResult);
  const toStr = keyToString ?? ((key: TKey) => key as unknown as string);
  const useStringKeys = keyToString != null;

  if (mode === "many") {
    if (useStringKeys) {
      const map = new Map<string, TFinalResult[]>();
      for (const row of results) {
        const k = toStr(getKeyFn(row));
        const arr = map.get(k);
        const mapped = await mapValueFn(row);
        if (arr) arr.push(mapped);
        else map.set(k, [mapped]);
      }
      return keys.map((k) => map.get(toStr(k)) ?? []);
    }

    const map = new Map<TKey, TFinalResult[]>();
    for (const row of results) {
      const k = getKeyFn(row);
      const arr = map.get(k);
      const mapped = await mapValueFn(row);
      if (arr) arr.push(mapped);
      else map.set(k, [mapped]);
    }
    return keys.map((k) => map.get(k) ?? []);
  }

  // mode === "one"
  if (useStringKeys) {
    const map = new Map<string, TFinalResult>();
    for (const row of results) {
      map.set(toStr(getKeyFn(row)), await mapValueFn(row));
    }
    return keys.map((k) => map.get(toStr(k)) ?? (defaultValue as TDefault));
  }

  const map = new Map<TKey, TFinalResult>();
  for (const row of results) {
    map.set(getKeyFn(row), await mapValueFn(row));
  }
  return keys.map((k) => map.get(k) ?? (defaultValue as TDefault));
}
