import type { CursorDirection } from "./pagination.ts";

/** Sort direction for one keyset cursor column. */
export type KeysetOrder = "asc" | "desc";

/** One sort column in the keyset — last column must be unique (tiebreaker). */
export type KeysetSortColumn = {
  /** Logical cursor key. Usually matches the field emitted by `cursor.fromItem`. */
  key: string;
  /** Natural sort direction. Defaults to `"asc"`. */
  order?: KeysetOrder;
};

/** Normalized keyset sort column with `order` defaulted. */
export type KeysetSortKey = {
  /** Logical cursor key. */
  key: string;
  /** Normalized sort direction. */
  order: KeysetOrder;
};

/** Portable comparison operation used by keyset predicates. */
export type KeysetCompareOp = "eq" | "gt" | "lt";

/** One portable keyset comparison, e.g. `createdAt > $1`. */
export type KeysetPredicate = {
  /** Logical cursor key. Adapter code maps this to a column/expression. */
  key: string;
  /** Comparison operator. */
  op: KeysetCompareOp;
  /** Cursor value. SQL adapters must pass this as a bind parameter. */
  value: unknown;
};

/** Conjunction of column comparisons — one branch of the lexicographic OR. */
export type KeysetWhereClause = {
  /** Comparisons joined with `AND`. */
  and: KeysetPredicate[];
};

/**
 * Lexicographic seek predicate: `(a > x) OR (a = x AND b > y) OR ...`.
 * `null` means first page (no cursor position).
 */
export type KeysetWhere = {
  /** Branches joined with `OR`. */
  or: KeysetWhereClause[];
};

/** Options for {@link createKeysetSpec}. */
export type CreateKeysetSpecOptions = {
  /** Sort columns in order; the last must be unique. Default order: `"asc"`. */
  sort: KeysetSortColumn[];
};

/**
 * Portable keyset pagination description.
 *
 * The spec does not know about SQL, Drizzle, Prisma, Kysely, or Knex. It only
 * describes ordering and lexicographic seek predicates in a small AST that
 * adapters can render to their own query APIs.
 */
export type KeysetSpec = {
  /** Normalized sort keys (defaults applied). */
  readonly sort: KeysetSortKey[];
  /** Column keys in sort order — handy for `cursor.fromItem` validation. */
  keys(): string[];
  /**
   * Sort keys for a fetch direction. Backward flips each column's order so
   * fetchers can `ORDER BY ... DESC` while the paginator restores natural order.
   */
  orderBy(direction?: CursorDirection): KeysetSortKey[];
  /**
   * Lexicographic keyset `WHERE` for the given cursor position.
   * `null` cursor ⇒ `null` (first page). Matches drizzle-cursor's `where()`.
   */
  where(
    cursor: Record<string, unknown> | null | undefined,
    direction?: CursorDirection,
  ): KeysetWhere | null;
};

/** Parameterized SQL fragment — values are never interpolated into the string. */
export type KeysetSqlFragment = {
  /** SQL fragment with placeholders, without leading `WHERE`. */
  sql: string;
  /** Bind parameters corresponding to placeholders in `sql`. */
  params: unknown[];
};

/** Options for raw SQL keyset rendering helpers. */
export type ToKeysetSqlOptions = {
  /** First bind index (1-based). Default: `1`. */
  paramStart?: number;
  /** Placeholder for bind index `n`. Default: PostgreSQL `$n`. */
  placeholder?: (index: number) => string;
};

/** Trusted server-owned SQL expression used as a keyset column target. */
export type KeysetSqlExpression = {
  /** SQL expression emitted directly into the query. Must be server-owned. */
  readonly sql: string;
  readonly __keysetSqlExpression: true;
};

/** Logical key → SQL identifier or explicit server-owned SQL expression. */
export type KeysetSqlColumns = Record<string, string | KeysetSqlExpression>;

/**
 * Return every non-empty prefix of an array.
 *
 * This is the primitive behind lexicographic keyset comparison:
 * `[a, b, c]` becomes `[a]`, `[a, b]`, `[a, b, c]`, which maps to
 * `(a > x) OR (a = x AND b > y) OR (a = x AND b = y AND c > z)`.
 *
 * @example
 * ```ts
 * generateSubArrays(["createdAt", "id"]);
 * // [["createdAt"], ["createdAt", "id"]]
 * ```
 */
export function generateSubArrays<T>(arr: ReadonlyArray<T>): T[][] {
  const subArrays: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    subArrays.push(arr.slice(0, i + 1));
  }
  return subArrays;
}

const SQL_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const OP_SQL: Record<KeysetCompareOp, string> = {
  eq: "=",
  gt: ">",
  lt: "<",
};

const normalizeOrder = (order: KeysetOrder | undefined): KeysetOrder => order ?? "asc";

const flipOrder = (order: KeysetOrder): KeysetOrder => (order === "asc" ? "desc" : "asc");

const forwardOp = (order: KeysetOrder, isLastInBranch: boolean): KeysetCompareOp => {
  if (isLastInBranch) {
    return order === "asc" ? "gt" : "lt";
  }
  return "eq";
};

const backwardOp = (order: KeysetOrder, isLastInBranch: boolean): KeysetCompareOp => {
  if (isLastInBranch) {
    return order === "asc" ? "lt" : "gt";
  }
  return "eq";
};

/**
 * Validate a SQL column identifier. Throws on unsafe input — identifiers must
 * come from your schema map, never from request data.
 *
 * This intentionally accepts only simple unquoted identifiers like `id` or
 * `created_at`. It rejects dotted paths, quoted identifiers, function calls,
 * whitespace, and semicolons. If you need computed expressions, wrap a
 * server-owned string with {@link keysetSqlExpression}.
 *
 * @example
 * ```ts
 * assertSqlIdentifier("created_at"); // ok
 * assertSqlIdentifier("created_at; DROP TABLE posts"); // throws
 * ```
 */
export function assertSqlIdentifier(identifier: string): string {
  if (!SQL_IDENTIFIER.test(identifier)) {
    throw new Error(
      `assertSqlIdentifier: invalid identifier "${identifier}" (use [a-zA-Z_][a-zA-Z0-9_]*)`,
    );
  }
  return identifier;
}

/**
 * Mark a server-owned SQL expression as safe for raw keyset SQL rendering.
 *
 * Use this for computed sort keys such as `upper(name)` or concatenated
 * values. Never pass request data here; cursor values still go through bind
 * parameters, but expressions are emitted directly into SQL.
 *
 * @example
 * ```ts
 * const columns = {
 *   normalizedName: keysetSqlExpression("upper(name)"),
 *   id: "id",
 * };
 * ```
 */
export function keysetSqlExpression(sql: string): KeysetSqlExpression {
  return { sql, __keysetSqlExpression: true };
}

const resolveColumn = (columns: KeysetSqlColumns, key: string): string => {
  const col = columns[key];
  if (col === undefined) {
    throw new Error(`toKeysetSql: missing column mapping for key "${key}"`);
  }
  if (typeof col !== "string") {
    return col.sql;
  }
  return assertSqlIdentifier(col);
};

const defaultPlaceholder = (index: number) => `$${index}`;

/**
 * Build a portable keyset pagination spec from sort columns. Returns a
 * structured `WHERE` AST and `ORDER BY` keys that ORM adapters (Drizzle,
 * Kysely, Prisma, Knex, raw SQL) translate into native queries.
 *
 * `sort` describes the natural order consumers should see. For backward
 * pagination, {@link KeysetSpec.orderBy} flips each sort direction so fetchers
 * can query in the opposite direction; `createPaginator` reverses those rows
 * back to natural order before returning them.
 *
 * The last sort key must be unique (usually `id`) to avoid skipped or
 * duplicated rows at page boundaries.
 *
 * @example
 * ```ts
 * const keyset = createKeysetSpec({
 *   sort: [
 *     { key: "createdAt", order: "asc" },
 *     { key: "id", order: "asc" },
 *   ],
 * });
 *
 * keyset.where({ createdAt: "2024-01-01", id: 42 }, "forward");
 * // { or: [
 * //   { and: [{ key: "createdAt", op: "gt", value: "2024-01-01" }] },
 * //   { and: [
 * //     { key: "createdAt", op: "eq", value: "2024-01-01" },
 * //     { key: "id", op: "gt", value: 42 },
 * //   ] },
 * // ] }
 * ```
 *
 * @throws If `sort` is empty.
 */
export function createKeysetSpec(options: CreateKeysetSpecOptions): KeysetSpec {
  const sort = options.sort.map((col) => ({
    key: col.key,
    order: normalizeOrder(col.order),
  }));

  if (sort.length === 0) {
    throw new Error("createKeysetSpec: `sort` must contain at least one column");
  }

  const keys = () => sort.map((col) => col.key);

  const orderBy = (direction: CursorDirection = "forward"): KeysetSortKey[] => {
    if (direction === "forward") {
      return sort.map((col) => ({ key: col.key, order: col.order }));
    }
    return sort.map((col) => ({ key: col.key, order: flipOrder(col.order) }));
  };

  const where = (
    cursor: Record<string, unknown> | null | undefined,
    direction: CursorDirection = "forward",
  ): KeysetWhere | null => {
    if (cursor == null) {
      return null;
    }

    const opFor = direction === "forward" ? forwardOp : backwardOp;
    const branches: KeysetWhereClause[] = [];

    for (const prefix of generateSubArrays(sort)) {
      const predicates: KeysetPredicate[] = [];
      for (const col of prefix) {
        const isLast = col === prefix.at(-1);
        const value = cursor[col.key];
        if (value === undefined) {
          throw new Error(
            `createKeysetSpec: cursor missing key "${col.key}" (expected: ${keys().join(", ")})`,
          );
        }
        predicates.push({
          key: col.key,
          op: opFor(col.order, isLast ?? false),
          value,
        });
      }
      branches.push({ and: predicates });
    }

    return { or: branches };
  };

  return { sort, keys, orderBy, where };
}

/**
 * Render a `KeysetWhere` AST as a parameterized SQL `WHERE` clause.
 * Returns `{ sql: "", params: [] }` for first page (`where` is `null`).
 *
 * Column names are taken from `columns` (logical key → SQL identifier or
 * {@link keysetSqlExpression}); cursor values are always bind parameters.
 *
 * The returned `sql` does not include the leading `WHERE`, so callers can omit
 * it for first-page queries.
 *
 * @example PostgreSQL-style placeholders
 * ```ts
 * const where = toKeysetWhereSql(keyset.where(cursor), {
 *   createdAt: "created_at",
 *   id: "id",
 * });
 *
 * await pg.query(
 *   `SELECT * FROM posts WHERE ${where.sql} ORDER BY created_at ASC, id ASC`,
 *   where.params,
 * );
 * ```
 *
 * @example MySQL/SQLite-style placeholders
 * ```ts
 * toKeysetWhereSql(where, columns, { placeholder: () => "?" });
 * ```
 *
 * @throws If a key is missing from `columns` or a column identifier is unsafe.
 */
export function toKeysetWhereSql(
  where: KeysetWhere | null,
  columns: KeysetSqlColumns,
  options: ToKeysetSqlOptions = {},
): KeysetSqlFragment {
  if (where == null) {
    return { sql: "", params: [] };
  }

  const paramStart = options.paramStart ?? 1;
  const placeholder = options.placeholder ?? defaultPlaceholder;
  const params: unknown[] = [];
  let paramIndex = paramStart;

  const nextPlaceholder = () => {
    const p = placeholder(paramIndex);
    paramIndex += 1;
    return p;
  };

  const branches = where.or.map((branch) => {
    const parts = branch.and.map((pred) => {
      const col = resolveColumn(columns, pred.key);
      const op = OP_SQL[pred.op];
      params.push(pred.value);
      return `${col} ${op} ${nextPlaceholder()}`;
    });
    return `(${parts.join(" AND ")})`;
  });

  return { sql: branches.join(" OR "), params };
}

/**
 * Render {@link KeysetSpec.orderBy} output as an SQL `ORDER BY` fragment.
 *
 * The returned string does not include the leading `ORDER BY`. Column
 * identifiers/expressions are resolved from `columns`. Plain strings are
 * validated with {@link assertSqlIdentifier}; computed expressions must be
 * explicitly wrapped with {@link keysetSqlExpression}. No request data should
 * ever be used for column mappings.
 *
 * @example
 * ```ts
 * toKeysetOrderBySql(keyset.orderBy("backward"), {
 *   createdAt: "created_at",
 *   id: "id",
 * });
 * // "created_at DESC, id DESC"
 * ```
 *
 * @throws If a key is missing from `columns` or a column identifier is unsafe.
 */
export function toKeysetOrderBySql(order: KeysetSortKey[], columns: KeysetSqlColumns): string {
  return order
    .map((col) => {
      const sqlCol = resolveColumn(columns, col.key);
      const dir = col.order === "asc" ? "ASC" : "DESC";
      return `${sqlCol} ${dir}`;
    })
    .join(", ");
}
