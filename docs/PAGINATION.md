# Pagination

Source-agnostic, type-safe pagination for `xtandard/pagination` (zero
dependencies). One paginator handles every input style, every data source,
and every output shape:

```
        inputs                    core                      outputs
┌─────────────────────┐   ┌──────────────────┐   ┌─────────────────────────┐
│ ?page=2&per_page=20 │   │                  │   │ { data, meta }   (REST) │
│ ?limit=20&offset=40 │ → │ createPaginator( │ → │ { edges, pageInfo }     │
│ ?cursor=abc         │   │   your fetchers  │   │            (Relay)      │
│ { first, after }    │   │ )                │   │ useInfiniteQuery config │
└─────────────────────┘   └──────────────────┘   │ paginator.pages/items() │
                                                 └─────────────────────────┘
```

The design splits pagination into three concerns:

1. **Input contracts** — what the caller asks for (`page`/`pageSize`,
   `limit`/`offset`, or an opaque cursor, forward or backward).
2. **Fetching** — a function **you** provide. The library never touches your
   data source, which is why it works equally for SQL, Drizzle, Prisma,
   Mongoose, an upstream HTTP API, or a plain array.
3. **Output contracts** — one uniform `Paginated<T>` envelope, with adapters
   to REST and Relay shapes and to TanStack Query.

Import pagination APIs from the sub-entry:

```ts
import { createPaginator, parsePaginationParams } from "xtandard/pagination";
```

Everything is [sync/async adaptive](./sync-async-adaptive.md): pass all-sync
fetchers (an in-memory array) and results come back as plain values with no
`await`; anything async makes them Promises — reflected in the types.

---

## Quick start

```ts
import { createPaginator, parsePaginationParams, toRestEnvelope } from "xtandard/pagination";

const userPaginator = createPaginator({
  // offset-capable source (SQL OFFSET, Mongo .skip(), array.slice...)
  fetchOffset: async ({ limit, offset }) => ({
    items: await db.query(`SELECT * FROM users ORDER BY id LIMIT $1 OFFSET $2`, [limit, offset]),
  }),
  // cursor-capable source (keyset / seek pagination)
  fetchCursor: async ({ limit, cursor, direction }) => ({
    items: await db.query(
      direction === "backward"
        ? `SELECT * FROM users WHERE id < $1 ORDER BY id DESC LIMIT $2`
        : `SELECT * FROM users WHERE id > $1 ORDER BY id ASC  LIMIT $2`,
      [cursor?.id ?? (direction === "backward" ? Infinity : 0), limit],
    ),
  }),
  cursor: { fromItem: (u) => ({ id: u.id }) },
});

// any input style works against the same paginator
const a = await userPaginator.paginate({ type: "page", page: 2, pageSize: 20 });
const b = await userPaginator.paginate({ type: "offset", limit: 20, offset: 40 });
const c = await userPaginator.paginate({ type: "cursor", limit: 20, cursor: a.pageInfo.endCursor });
```

Every call returns the same envelope:

```ts
type Paginated<T> = {
  items: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string | null; // present when cursors are configured
    endCursor?: string | null;
    page?: number; // present for page/offset requests
    pageSize?: number;
    totalItems?: number; // present when your fetcher reports it
    totalPages?: number;
  };
};
```

---

## Choosing a pagination style

```
Need "jump to page N" or total page count?
├─ yes → offset/page (provide fetchOffset, optionally totalItems)
└─ no
   ├─ data changes while user paginates (feeds, live tables)?
   │  └─ yes → cursor (provide fetchCursor + cursor.fromItem)
   └─ small/static dataset, in-memory only?
      └─ offset/page with sync fetchOffset is enough
```

Support both when you have mixed clients: admin UIs on `?page=` and mobile
feeds on `?cursor=`. One paginator, two fetchers.

---

## Core concepts

### The three input styles

```ts
type PaginationInput =
  | { type: "page"; page: number; pageSize: number } // 1-based
  | { type: "offset"; limit: number; offset: number }
  | { type: "cursor"; limit: number; cursor?: string | null; direction?: "forward" | "backward" };
```

`page` and `offset` are interconvertible (`offset = (page - 1) * pageSize` —
see `toOffsetWindow`), so they share one fetcher. Cursor pagination is
fundamentally different (it seeks by value, not by position) and gets its own
fetcher. A paginator supports whichever styles you give it fetchers for;
asking for an unsupported style throws immediately with a clear message.

When to use which:

| Style             | Pros                                                  | Cons                                                                         | Typical use                         |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| `page`/`pageSize` | familiar, jump to page N, total pages                 | drifts when rows are inserted/deleted; `OFFSET` is slow deep in large tables | admin tables, search results        |
| `limit`/`offset`  | same as page, more direct                             | same as page                                                                 | APIs mirroring SQL                  |
| `cursor`          | stable under writes, fast at any depth, bidirectional | no "jump to page 7", needs a deterministic unique sort                       | feeds, infinite scroll, public APIs |

### The fetcher contract

Your fetchers receive a normalized **window**:

```ts
// fetchOffset receives:
{
  limit: number;
  offset: number;
}

// fetchCursor receives:
{
  limit: number;
  cursor: TCursor | null;
  direction: "forward" | "backward";
}
```

Three rules:

1. **Fetch up to `window.limit` rows — do not cap it yourself.** The limit
   already includes a one-row lookahead the paginator uses to compute
   `hasNextPage` without a `COUNT(*)`. If you fetch fewer rows than asked,
   `hasNextPage` will be wrong.
2. **`cursor` is already decoded.** You receive the plain object your
   `fromItem` produced (e.g. `{ id: 42 }`), never the opaque token. `null`
   means "first page".
3. **When `direction` is `"backward"`, flip your sort order** (`ORDER BY id
DESC` instead of `ASC`) and return rows in that flipped order. The
   paginator reverses them back, so consumers always see natural order.

Optionally return `totalItems` alongside `items` (run a count when it's
cheap) and the envelope gains `totalItems`/`totalPages`.

### `hasNextPage` for offset/page requests

Two strategies, chosen automatically:

| `totalItems` from fetcher | How `hasNextPage` is computed                |
| ------------------------- | -------------------------------------------- |
| not provided              | lookahead: `fetched.length > requestedLimit` |
| provided                  | `offset + items.length < totalItems` (exact) |

`hasPreviousPage` is always `offset > 0`. When `totalItems` is present,
`totalPages = ceil(totalItems / pageSize)` is added to `pageInfo`.

### `maxLimit` (paginator-side cap)

Separate from `parsePaginationParams`'s `maxPageSize` (transport clamp).
`createPaginator({ maxLimit: 100 })` caps any requested `limit`/`pageSize`
before the `+1` lookahead is applied — so a client asking for 500 gets
`limit: 100` in the window and `limit: 101` handed to the fetcher.

Use both: `maxPageSize` at the HTTP boundary, `maxLimit` as defense-in-depth
inside the paginator.

### Cursors on page/offset results

If you configure `cursor.fromItem` (even without `fetchCursor`), page and
offset responses still get `pageInfo.startCursor`/`endCursor` encoding the
first and last item on the page. This lets REST clients upgrade to cursor
pagination without a second endpoint:

```ts
// page 2 of an admin table — meta still carries cursors for deep-linking
const result = await paginator.paginate({ type: "page", page: 2, pageSize: 20 });
// result.pageInfo.endCursor → opaque token for "continue after last row here"
```

Cursor _requests_ still require `fetchCursor`.

### `toOffsetWindow` clamping

`toOffsetWindow` normalizes invalid transport input before it reaches your
fetcher:

- `page` floors to `1`, `pageSize`/`limit` floors to `1`
- `offset` floors to `0`
- `page` input: `offset = (page - 1) * pageSize`
- offset input passes through after clamping

The paginator also computes a synthetic `page` in `pageInfo` for offset
requests: `floor(offset / limit) + 1`.

### Cursors

A cursor is the data needed to find an item again: typically the values of
your `ORDER BY` columns, always ending in something unique.

```ts
cursor: {
  // extract cursor data from an item — MUST match your sort columns
  fromItem: (post) => ({ createdAt: post.createdAt, id: post.id }),
  // optional: how cursor data becomes an opaque token (see "Cursor codecs")
  codec: createCursorCodec(),
}
```

> **Rule of thumb:** if you sort by `createdAt`, the cursor must contain
> `createdAt` _and_ a tiebreaker (`id`), and your keyset `WHERE` must compare
> the tuple: `(created_at, id) < ($1, $2)`. A non-unique sort produces
> skipped or duplicated rows at page boundaries.

`paginator.cursorFor(item)` encodes the token for any item — useful for
per-edge cursors in GraphQL or for "start reading from this row" links.

### Empty pages

When a fetcher returns zero rows:

- `items` is `[]`
- `hasNextPage` / `hasPreviousPage` reflect position (offset > 0 ⇒
  `hasPreviousPage: true`; cursor with a token ⇒ opposite-direction flag)
- `startCursor`/`endCursor` stay `null`/`undefined` (nothing to encode)
- `pages()` / `items()` stop immediately on an empty page

### Backward pagination (the Twitter-feed case)

Forward walks the natural order; backward walks against it — "scroll up for
newer posts". Request it with `direction: "backward"`:

```ts
// user is positioned at `token`, scrolls up:
const newer = await feedPaginator.paginate({
  type: "cursor",
  limit: 20,
  cursor: token,
  direction: "backward",
});
// newer.items are in natural order; newer.pageInfo.startCursor continues upward
```

Semantics follow the Relay convention: in the direction you're walking, the
`has*Page` flag comes from the lookahead row; in the opposite direction it's
inferred from "you came from somewhere" (a cursor was provided).

---

## Data source recipes (backend)

### Adapter and recipe coverage

The core pagination package is data-source agnostic. Use a first-party adapter
when it materially improves type safety or builder ergonomics; otherwise use
the raw SQL helpers or plain fetcher examples directly.

| Data source                           | Recommended path                                       |
| ------------------------------------- | ------------------------------------------------------ |
| In-memory arrays                      | `fetchOffset` with `slice`                             |
| Raw SQL drivers (`pg`, `mysql2`, etc) | `toKeysetWhereSql` + `toKeysetOrderBySql`              |
| Prisma Client                         | `xtandard/pagination/prisma` or Prisma raw SQL         |
| Drizzle ORM                           | `xtandard/pagination/drizzle`                          |
| Kysely                                | `xtandard/pagination/kysely`                           |
| MikroORM                              | QueryBuilder + raw SQL fragments                       |
| TypeORM                               | QueryBuilder + `Brackets` + raw SQL fragments          |
| Sequelize                             | `Op.or` / `Op.and` objects or raw SQL fragments        |
| Knex.js                               | `xtandard/pagination/knex`                             |
| Objection.js                          | Knex adapter through `query()`                         |
| AdonisJS Lucid                        | Knex-style `whereRaw` / `orderByRaw`                   |
| Slonik                                | raw SQL helper params passed through `sql.array`-style |
| Postgres.js                           | raw SQL helper params passed to tagged templates       |
| PgTyped                               | generated SQL with explicit cursor params              |
| Zapatos                               | raw SQL helper fragments or `conditions` objects       |
| `@databases`                          | raw SQL helper params with tagged SQL                  |
| `ts-sql-query`                        | native dynamic boolean expressions                     |
| SafeQL                                | raw SQL recipe; SafeQL validates it                    |
| `@effect/sql`                         | raw SQL helper params inside Effect queries            |
| Bookshelf.js                          | Knex adapter via `query((qb) => ...)`                  |
| Waterline                             | offset pagination; cursor recipe when datastore allows |
| MassiveJS                             | raw SQL helper params                                  |
| MongoDB / Mongoose                    | `xtandard/pagination/mongo`                            |
| Firestore                             | native ordered cursors (`startAfter`, `endBefore`)     |
| DynamoDB                              | `LastEvaluatedKey` / `ExclusiveStartKey`               |
| Redis sorted sets                     | `ZRANGE`/`ZREVRANGE` by score + member                 |
| Elasticsearch / OpenSearch            | `search_after` with stable sort                        |
| Meilisearch / Typesense               | offset by default; cursor only if using stable filters |
| ClickHouse                            | raw SQL helper params                                  |
| BigQuery / Snowflake                  | raw SQL helper params for stable export pagination     |

For every recipe, keep the same safety boundary: request data may become
bound values, never identifiers or expression strings. Column maps, field maps,
index names, and computed expressions must be server-owned constants.

### In-memory array — fully synchronous

```ts
const paginator = createPaginator({
  fetchOffset: ({ limit, offset }) => ({
    items: rows.slice(offset, offset + limit),
    totalItems: rows.length,
  }),
});

// all-sync tier: plain values, no await, usable in a render path
const { items, pageInfo } = paginator.paginate({ type: "page", page: 1, pageSize: 10 });
```

### Raw SQL — composite keyset

For `ORDER BY created_at ASC, id ASC` forward pagination after cursor
`{ createdAt, id }`:

```sql
SELECT *
FROM posts
WHERE (created_at, id) > ($1::timestamptz, $2::bigint)
ORDER BY created_at ASC, id ASC
LIMIT $3;
```

Backward flips the comparator and sort:

```sql
SELECT *
FROM posts
WHERE (created_at, id) < ($1::timestamptz, $2::bigint)
ORDER BY created_at DESC, id DESC
LIMIT $3;
```

First page: omit the `WHERE` (cursor is `null`). The paginator reverses
backward results back to natural order.

The zero-dependency raw SQL helpers produce parameterized fragments from the
portable keyset AST. Cursor values are never interpolated into SQL; they are
returned in `params`. Column identifiers come from your hardcoded `columns`
map and are validated with `assertSqlIdentifier`.

```ts
import {
  createKeysetSpec,
  createPaginator,
  keysetSqlExpression,
  toKeysetOrderBySql,
  toKeysetWhereSql,
} from "xtandard/pagination";

const keyset = createKeysetSpec({
  sort: [
    { key: "createdAt", order: "asc" },
    { key: "id", order: "asc" },
  ],
});

const columns = {
  createdAt: "created_at",
  id: "id",
};

// `key` is logical cursor data, not necessarily a table column name.
// For computed values, mark server-owned SQL expressions explicitly:
const expressionColumns = {
  normalizedName: keysetSqlExpression("upper(first_name || ' ' || last_name)"),
  id: "id",
};

const paginator = createPaginator({
  fetchCursor: async ({ limit, cursor, direction }) => {
    const where = toKeysetWhereSql(keyset.where(cursor, direction), columns);
    const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), columns);

    const sql = `
      SELECT *
      FROM posts
      ${where.sql ? `WHERE ${where.sql}` : ""}
      ORDER BY ${orderBy}
      LIMIT $${where.params.length + 1}
    `;

    return { items: (await pg.query(sql, [...where.params, limit])).rows };
  },
  cursor: { fromItem: (post) => ({ createdAt: post.createdAt, id: post.id }) },
});
```

For a cursor `{ createdAt: "2024-01-01", id: 42 }`, the helper emits:

```ts
{
  sql: "(created_at > $1) OR (created_at = $2 AND id > $3)",
  params: ["2024-01-01", "2024-01-01", 42],
}
```

#### Knex raw bindings

[Knex `whereRaw`](https://knexjs.org/guide/raw.html) accepts SQL plus
bindings. Use `?` placeholders:

```ts
import { applyKeysetToKnex } from "xtandard/pagination/knex";

fetchCursor: async ({ limit, cursor, direction }) => {
  const q = applyKeysetToKnex(
    knex("posts").select("*"),
    keyset.where(cursor, direction),
    keyset.orderBy(direction),
    { columns },
  );

  return { items: await q.limit(limit) };
};
```

`applyKeysetToKnex` is zero-dependency: it targets Knex's structural
`whereRaw(sql, bindings)` / `orderByRaw(sql)` shape, so `knex` remains your
application dependency rather than a peer dependency of `xtandard`.

#### Prisma raw queries

Prisma cannot parameterize identifiers in `$queryRaw`, so use
`$queryRawUnsafe` only with SQL you build from server-owned, validated
identifiers. Cursor values are still bound parameters:

```ts
fetchCursor: async ({ limit, cursor, direction }) => {
  const where = toKeysetWhereSql(keyset.where(cursor, direction), columns);
  const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), columns);

  const sql = `
    SELECT *
    FROM posts
    ${where.sql ? `WHERE ${where.sql}` : ""}
    ORDER BY ${orderBy}
    LIMIT $${where.params.length + 1}
  `;

  return { items: await prisma.$queryRawUnsafe(sql, ...where.params, limit) };
};
```

This stays injection-safe as long as `columns` is a hardcoded map and request
data only reaches `params`.

#### Drizzle and Kysely raw APIs

Drizzle and Kysely both support raw SQL, but their safest path is a dedicated
adapter that maps `KeysetWhere` into their expression builders instead of
pre-rendering `$1` strings. Until those adapters exist, prefer their native
builder examples below. The core raw helper is best for drivers and APIs that
already accept `(sql, params)` directly: `pg`, `mysql2`, `better-sqlite3`,
Knex, and carefully-used Prisma raw queries.

### Drizzle ORM

Use `xtandard/pagination/drizzle` to turn the portable keyset AST into
Drizzle `where` and `orderBy` SQL expressions. The adapter accepts Drizzle
columns or `sql` expressions; cursor keys remain logical names.

```ts
import { sql } from "drizzle-orm";
import { createKeysetSpec, createPaginator } from "xtandard/pagination";
import { toDrizzleKeyset } from "xtandard/pagination/drizzle";

const keyset = createKeysetSpec({
  sort: [
    { key: "createdAt", order: "asc" },
    { key: "id", order: "asc" },
  ],
});

const drizzleKeyset = toDrizzleKeyset({
  createdAt: users.createdAt,
  id: users.id,
});

const expressionKeyset = toDrizzleKeyset({
  normalizedName: sql<string>`upper(${users.firstName} || ' ' || ${users.lastName})`,
  id: users.id,
});

const paginator = createPaginator({
  fetchOffset: async ({ limit, offset }) => ({
    items: await db
      .select()
      .from(users)
      .orderBy(asc(users.createdAt), asc(users.id))
      .limit(limit)
      .offset(offset),
  }),
  fetchCursor: async ({ limit, cursor, direction }) => ({
    items: await db
      .select()
      .from(users)
      .where(drizzleKeyset.where(keyset.where(cursor, direction)))
      .orderBy(...drizzleKeyset.orderBy(keyset.orderBy(direction)))
      .limit(limit),
  }),
  cursor: { fromItem: (u) => ({ createdAt: u.createdAt, id: u.id }) },
});
```

[drizzle-cursor](https://github.com/xantiagoma/drizzle-cursor) remains useful
for existing Drizzle-only projects. The lower-level codec pipeline is
signature-compatible (see [Cursor codecs](#cursor-codecs)), so custom cursor
encoders/decoders can be shared.

### Kysely

```ts
import { sql } from "kysely";
import { createKeysetSpec, createPaginator } from "xtandard/pagination";
import { toKyselyKeyset } from "xtandard/pagination/kysely";

const keyset = createKeysetSpec({
  sort: [
    { key: "createdAt", order: "asc" },
    { key: "id", order: "asc" },
  ],
});

const kyselyKeyset = toKyselyKeyset({
  createdAt: "users.created_at",
  id: "users.id",
});

const expressionKeyset = toKyselyKeyset({
  normalizedName: sql<string>`upper(first_name || ' ' || last_name)`,
  id: "users.id",
});

const paginator = createPaginator({
  fetchOffset: async ({ limit, offset }) => ({
    items: await db
      .selectFrom("users")
      .selectAll()
      .orderBy("created_at")
      .orderBy("id")
      .limit(limit)
      .offset(offset)
      .execute(),
  }),
  fetchCursor: async ({ limit, cursor, direction }) => {
    let q = db.selectFrom("users").selectAll();

    const where = kyselyKeyset.where(keyset.where(cursor, direction));
    if (where) {
      q = q.where(where);
    }

    for (const order of kyselyKeyset.orderBy(keyset.orderBy(direction))) {
      q = q.orderBy(order);
    }

    return {
      items: await q.limit(limit).execute(),
    };
  },
  cursor: { fromItem: (u) => ({ createdAt: u.created_at, id: u.id }) },
});
```

### Prisma

```ts
import { createKeysetSpec, createPaginator } from "xtandard/pagination";
import { toPrismaKeyset } from "xtandard/pagination/prisma";

const keyset = createKeysetSpec({
  sort: [
    { key: "createdAt", order: "asc" },
    { key: "id", order: "asc" },
  ],
});

const prismaKeyset = toPrismaKeyset({
  createdAt: "createdAt",
  id: "id",
});

const paginator = createPaginator({
  fetchOffset: async ({ limit, offset }) => ({
    items: await prisma.user.findMany({
      take: limit,
      skip: offset,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  }),
  fetchCursor: async ({ limit, cursor, direction }) => ({
    items: await prisma.user.findMany({
      take: limit,
      where: prismaKeyset.where(keyset.where(cursor, direction)),
      orderBy: prismaKeyset.orderBy(keyset.orderBy(direction)),
    }),
  }),
  cursor: { fromItem: (u) => ({ createdAt: u.createdAt, id: u.id }) },
});
```

The Prisma adapter targets scalar fields. Prisma's typed client cannot express
arbitrary computed SQL keysets; use the raw SQL helpers (`toKeysetWhereSql` /
`toKeysetOrderBySql`) with Prisma raw queries for computed expressions.

### MongoDB / Mongoose

```ts
import { createKeysetSpec, createPaginator } from "xtandard/pagination";
import { toMongoKeyset } from "xtandard/pagination/mongo";

const keyset = createKeysetSpec({
  sort: [
    { key: "createdAt", order: "asc" },
    { key: "id", order: "asc" },
  ],
});

const mongoKeyset = toMongoKeyset({
  createdAt: "createdAt",
  id: "_id",
});

const paginator = createPaginator({
  fetchOffset: async ({ limit, offset }) => ({
    items: await Post.find().sort({ _id: 1 }).skip(offset).limit(limit),
  }),
  fetchCursor: async ({ limit, cursor, direction }) => ({
    items: await Post.find(mongoKeyset.filter(keyset.where(cursor, direction)) ?? {})
      .sort(mongoKeyset.sort(keyset.orderBy(direction)))
      .limit(limit),
  }),
  cursor: { fromItem: (p) => ({ createdAt: p.createdAt, id: p._id.toString() }) },
});
```

The Mongo adapter accepts dotted field paths such as `author.name`, rejects
operator-like field strings such as `$where`, and works with both the MongoDB
driver and Mongoose's `find(filter).sort(sort)` API.

### TypeORM

TypeORM's query builder accepts grouped raw predicates via `Brackets`. Render
the portable keyset AST with named placeholders and bind cursor values through
`.setParameters()`.

```ts
import { Brackets } from "typeorm";
import {
  createKeysetSpec,
  keysetSqlExpression,
  toKeysetOrderBySql,
  toKeysetWhereSql,
} from "xtandard/pagination";

const keyset = createKeysetSpec({
  sort: [
    { key: "createdAt", order: "asc" },
    { key: "id", order: "asc" },
  ],
});

const columns = {
  createdAt: keysetSqlExpression("post.created_at"),
  id: keysetSqlExpression("post.id"),
};

fetchCursor: async ({ limit, cursor, direction }) => {
  const where = toKeysetWhereSql(keyset.where(cursor, direction), columns, {
    placeholder: (index) => `:p${index}`,
  });
  const params = Object.fromEntries(where.params.map((value, index) => [`p${index + 1}`, value]));

  const qb = repo.createQueryBuilder("post");
  if (where.sql) qb.andWhere(new Brackets((q) => q.where(where.sql)), params);

  return {
    items: await qb
      .orderBy(toKeysetOrderBySql(keyset.orderBy(direction), columns))
      .limit(limit)
      .getMany(),
  };
};
```

### MikroORM

MikroORM's QueryBuilder can consume raw fragments through `.where()` and
`.orderBy()`. Use a hardcoded SQL column map for the keyset predicate, and map
natural offset ordering to entity property names when using object `orderBy`.

```ts
const columns = {
  createdAt: keysetSqlExpression("p.created_at"),
  id: keysetSqlExpression("p.id"),
};

fetchCursor: async ({ limit, cursor, direction }) => {
  const where = toKeysetWhereSql(keyset.where(cursor, direction), columns, {
    placeholder: "?",
  });

  const qb = em.createQueryBuilder(Post, "p").select("*");
  if (where.sql) qb.where(where.sql, where.params);

  return {
    items: await qb
      .orderBy(Object.fromEntries(keyset.orderBy(direction).map((o) => [o.key, o.order])))
      .limit(limit)
      .execute(),
  };
};
```

### Sequelize

Sequelize can express lexicographic keyset predicates as `Op.or` / `Op.and`
objects. For simple scalar fields, build the filter from the keyset AST; for
computed SQL expressions, use `Sequelize.literal` only with server-owned
expressions and keep cursor values bound.

```ts
import { Op } from "sequelize";
import { createKeysetSpec } from "xtandard/pagination";

const sequelizeOps = { ">": Op.gt, ">=": Op.gte, "<": Op.lt, "<=": Op.lte, "=": Op.eq };

function toSequelizeWhere(where) {
  if (!where) return undefined;
  return {
    [Op.or]: where.clauses.map((clause) => ({
      [Op.and]: clause.predicates.map((predicate) => ({
        [predicate.key]: { [sequelizeOps[predicate.op]]: predicate.value },
      })),
    })),
  };
}

fetchCursor: async ({ limit, cursor, direction }) => ({
  items: await User.findAll({
    where: toSequelizeWhere(keyset.where(cursor, direction)),
    order: keyset.orderBy(direction).map((o) => [o.key, o.order.toUpperCase()]),
    limit,
  }),
});
```

### Objection.js

Objection is Knex-backed, so use the Knex adapter against `Model.query()`.

```ts
import { applyKeysetToKnex } from "xtandard/pagination/knex";

fetchCursor: async ({ limit, cursor, direction }) => {
  const q = applyKeysetToKnex(
    Person.query(),
    keyset.where(cursor, direction),
    keyset.orderBy(direction),
    { columns: { createdAt: "created_at", id: "id" } },
  );

  return { items: await q.limit(limit) };
};
```

### AdonisJS Lucid

Lucid's query builder has Knex-compatible raw methods, so the Knex adapter is
usually enough.

```ts
fetchCursor: async ({ limit, cursor, direction }) => {
  const q = applyKeysetToKnex(
    Post.query(),
    keyset.where(cursor, direction),
    keyset.orderBy(direction),
    { columns: { createdAt: "created_at", id: "id" } },
  );

  return { items: await q.limit(limit) };
};
```

### Slonik

Slonik's tagged SQL API should own SQL composition. Use the raw helper for the
predicate shape and pass cursor values as bound values. Keep `columns`
server-owned.

```ts
const where = toKeysetWhereSql(keyset.where(cursor, direction), columns, {
  placeholder: (index) => `$${index}`,
});
const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), columns);

const result = await pool.query(
  sql.unsafe`
  SELECT * FROM posts
  ${where.sql ? sql.unsafe`WHERE ${sql.unsafe([where.sql])}` : sql.fragment``}
  ORDER BY ${sql.unsafe([orderBy])}
  LIMIT ${limit}
`,
  where.params,
);
```

If your Slonik policy disallows unsafe fragments, write the few supported
keyset predicates manually with `sql.identifier` for each server-owned column.

### Postgres.js

Postgres.js supports dynamic fragments and bound values. Use raw helper output
for predicate text and pass all cursor values through the tag.

```ts
const where = toKeysetWhereSql(keyset.where(cursor, direction), columns, {
  placeholder: (index) => `$${index}`,
});
const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), columns);

const rows = await sql.unsafe(
  `SELECT * FROM posts ${where.sql ? `WHERE ${where.sql}` : ""} ORDER BY ${orderBy} LIMIT $${where.params.length + 1}`,
  [...where.params, limit],
);
```

### PgTyped

PgTyped works best when the SQL is static. Write the supported keyset shape in
SQL and let PgTyped generate types for the cursor params.

```sql
/* @name listPostsAfter */
SELECT *
FROM posts
WHERE (:createdAt::timestamptz IS NULL)
   OR (created_at > :createdAt::timestamptz)
   OR (created_at = :createdAt::timestamptz AND id > :id::bigint)
ORDER BY created_at ASC, id ASC
LIMIT :limit!;
```

Use `createPaginator` to normalize inputs and call the generated PgTyped
function from `fetchCursor`.

### Zapatos

Zapatos can run SQL fragments directly. Use the raw SQL helper when the query
is too dynamic for `conditions`.

```ts
const where = toKeysetWhereSql(keyset.where(cursor, direction), columns);
const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), columns);

const rows = await db.sql`
  SELECT * FROM ${"posts"}
  ${db.raw(where.sql ? `WHERE ${where.sql}` : "")}
  ORDER BY ${db.raw(orderBy)}
  LIMIT ${db.param(limit)}
`.run(pool, where.params);
```

### `@databases`

`@databases/pg` and `@databases/mysql` expose tagged SQL APIs. Keep identifier
fragments static and bind cursor values.

```ts
const where = toKeysetWhereSql(keyset.where(cursor, direction), columns);
const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), columns);

const rows = await db.query(
  sql`
  SELECT * FROM posts
  ${where.sql ? sql.__dangerous__rawValue(`WHERE ${where.sql}`) : sql``}
  ORDER BY ${sql.__dangerous__rawValue(orderBy)}
  LIMIT ${limit}
`,
  where.params,
);
```

### `ts-sql-query`

`ts-sql-query` can model the predicate in its own expression system. Use the
keyset AST as the portable source of truth, then convert each predicate to a
builder comparison.

```ts
const fields = { createdAt: t.createdAt, id: t.id };

function toTsSqlQueryWhere(where) {
  if (!where) return undefined;
  return connection.or(
    ...where.clauses.map((clause) =>
      connection.and(
        ...clause.predicates.map((p) => {
          const field = fields[p.key];
          if (p.op === ">") return field.greaterThan(p.value);
          if (p.op === "<") return field.lessThan(p.value);
          return field.equals(p.value);
        }),
      ),
    ),
  );
}
```

### SafeQL

SafeQL is not a query builder; it validates SQL strings. Prefer static SQL for
each supported sort shape and call it from `fetchCursor`. If you use the raw
helpers, keep the `columns` map fixed so the generated SQL shape is still
reviewable.

```ts
// SafeQL validates the static query; createPaginator supplies typed params.
const posts = await sql`
  SELECT * FROM posts
  WHERE created_at > ${cursor.createdAt}
     OR (created_at = ${cursor.createdAt} AND id > ${cursor.id})
  ORDER BY created_at ASC, id ASC
  LIMIT ${limit}
`;
```

### `@effect/sql`

Wrap the same fetcher contract in an Effect. `createPaginator` does not care
whether your data source is Effect-powered as long as `fetchCursor` returns a
Promise or a plain value.

```ts
fetchCursor: ({ limit, cursor, direction }) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* SqlClient.SqlClient;
      const where = toKeysetWhereSql(keyset.where(cursor, direction), columns);
      const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), columns);
      const items = yield* client.unsafe(
        `SELECT * FROM posts ${where.sql ? `WHERE ${where.sql}` : ""} ORDER BY ${orderBy} LIMIT $${where.params.length + 1}`,
        [...where.params, limit],
      );
      return { items };
    }),
  );
```

### Bookshelf.js

Bookshelf models expose the underlying Knex query builder through `.query()`.

```ts
fetchCursor: async ({ limit, cursor, direction }) => {
  const collection = await Post.collection()
    .query((qb) => {
      applyKeysetToKnex(qb, keyset.where(cursor, direction), keyset.orderBy(direction), {
        columns,
      });
      qb.limit(limit);
    })
    .fetch();

  return { items: collection.toArray() };
};
```

### Waterline

Waterline is offset-first. Use `fetchOffset` when you are targeting multiple
datastores through the same model API.

```ts
const paginator = createPaginator({
  fetchOffset: async ({ limit, offset }) => ({
    items: await User.find().sort("createdAt ASC").skip(offset).limit(limit),
  }),
});
```

For cursor pagination, drop down to the datastore's native query API and use
that backend's recipe (`sendNativeQuery` for SQL, Mongo criteria for MongoDB).

### MassiveJS

MassiveJS is SQL-centric, so use the raw helper output with parameter arrays.

```ts
const where = toKeysetWhereSql(keyset.where(cursor, direction), columns);
const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), columns);

const items = await db.query(
  `SELECT * FROM posts ${where.sql ? `WHERE ${where.sql}` : ""} ORDER BY ${orderBy} LIMIT $${where.params.length + 1}`,
  [...where.params, limit],
);
```

### Firestore

Firestore has native cursor methods, but the cursor is positional: it must
contain values in the same order as the `orderBy` calls. Include a unique
tiebreaker such as `FieldPath.documentId()`.

```ts
import { FieldPath } from "firebase-admin/firestore";

const paginator = createPaginator({
  fetchCursor: async ({ limit, cursor, direction }) => {
    const descending = direction === "backward";
    let q = db
      .collection("posts")
      .orderBy("createdAt", descending ? "desc" : "asc")
      .orderBy(FieldPath.documentId(), descending ? "desc" : "asc")
      .limit(limit);

    if (cursor) {
      q = q.startAfter(cursor.createdAt, cursor.id);
    }

    const snap = await q.get();
    return { items: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  },
  cursor: { fromItem: (p) => ({ createdAt: p.createdAt, id: p.id }) },
});
```

Firestore requires composite indexes for multi-field ordering. Backward
pagination flips the ordering; the paginator reverses rows back to natural
order.

### DynamoDB

DynamoDB is not general keyset pagination over arbitrary fields. Its native
pagination token is `LastEvaluatedKey`, which must be passed back as
`ExclusiveStartKey`. Derive that key from the last item on the page when
querying one partition or a single index.

```ts
const paginator = createPaginator({
  fetchCursor: async ({ limit, cursor }) => {
    const result = await client.send(
      new QueryCommand({
        TableName: "Posts",
        KeyConditionExpression: "tenantId = :tenantId",
        ExpressionAttributeValues: { ":tenantId": { S: tenantId } },
        ExclusiveStartKey: cursor?.exclusiveStartKey,
        Limit: limit,
        ScanIndexForward: true,
      }),
    );

    return { items: result.Items ?? [] };
  },
  cursor: {
    fromItem: (item) => ({
      exclusiveStartKey: { tenantId: item.tenantId, sk: item.sk },
    }),
  },
});
```

If you need stable ordering by `createdAt`, model it as the table or GSI sort
key (`PK = tenant`, `SK = createdAt#id`). Avoid `Scan` for cursor pagination.

### Redis sorted sets

Redis cursor pagination is practical for sorted sets. Use score plus member as
the stable cursor; the member acts as the tiebreaker when multiple items share
the same score.

```ts
const paginator = createPaginator({
  fetchCursor: async ({ limit, cursor, direction }) => {
    const reverse = direction === "backward";
    const command = reverse ? "ZREVRANGEBYSCORE" : "ZRANGEBYSCORE";
    const min = cursor && !reverse ? `(${cursor.score}` : "-inf";
    const max = cursor && reverse ? `(${cursor.score}` : "+inf";

    const rows = await redis.send(command, ["feed", min, max, "WITHSCORES", "LIMIT", 0, limit]);
    return { items: pairsToItems(rows) };
  },
  cursor: { fromItem: (item) => ({ score: item.score, member: item.id }) },
});
```

For strict no-duplicate behavior when scores collide, encode the tiebreaker in
the score or use lexicographic sorted-set commands with a composite member.

### Elasticsearch / OpenSearch

Use `search_after` with a deterministic `sort` array. Always include a unique
tiebreaker field; Elasticsearch often uses a doc-values copy of `_id`.

```ts
const sort = [
  { createdAt: direction === "backward" ? "desc" : "asc" },
  { idKeyword: direction === "backward" ? "desc" : "asc" },
];

const response = await elastic.search({
  index: "posts",
  size: limit,
  sort,
  search_after: cursor ? [cursor.createdAt, cursor.id] : undefined,
  query: { bool: { filter: [{ term: { tenantId } }] } },
});

return {
  items: response.hits.hits.map((hit) => ({ ...hit._source, sort: hit.sort })),
};
```

Cursor extraction should use the returned `hit.sort`, not `_source`, because
the sort values are exactly what the next `search_after` call expects.

### Meilisearch / Typesense

These search engines are usually offset-first for public search result pages.
Use `fetchOffset` unless you have a stable sortable field and the engine/API
supports search-after-style pagination for your query.

```ts
const paginator = createPaginator({
  fetchOffset: async ({ limit, offset }) => {
    const result = await index.search(query, { limit, offset });
    return { items: result.hits, totalItems: result.estimatedTotalHits };
  },
});
```

For live feeds or audit logs, prefer the database/index behind the search
engine for cursor pagination and use search only for relevance-ranked pages.

### ClickHouse

ClickHouse supports normal SQL keyset pagination. Prefer keyset pagination for
append-only analytics tables; `OFFSET` can be expensive on large result sets.

```ts
const where = toKeysetWhereSql(
  keyset.where(cursor, direction),
  {
    eventTime: "event_time",
    id: "event_id",
  },
  {
    placeholder: (index) => `{p${index}:String}`,
  },
);
const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), {
  eventTime: "event_time",
  id: "event_id",
});

const rows = await clickhouse.query({
  query: `
    SELECT * FROM events
    ${where.sql ? `WHERE ${where.sql}` : ""}
    ORDER BY ${orderBy}
    LIMIT {limit:UInt32}
  `,
  query_params: { ...Object.fromEntries(where.params.map((v, i) => [`p${i + 1}`, v])), limit },
});
```

Use a sort that matches the table's primary/order key when possible.

### BigQuery / Snowflake

Warehouse pagination is usually for exports, not interactive feeds. Use a
stable keyset over materialized results or an ordered table, and bind cursor
values through query parameters.

```ts
const where = toKeysetWhereSql(keyset.where(cursor, direction), columns, {
  placeholder: (index) => `@p${index}`,
});
const orderBy = toKeysetOrderBySql(keyset.orderBy(direction), columns);

const [rows] = await bigquery.query({
  query: `
    SELECT * FROM dataset.events
    ${where.sql ? `WHERE ${where.sql}` : ""}
    ORDER BY ${orderBy}
    LIMIT @limit
  `,
  params: { ...Object.fromEntries(where.params.map((v, i) => [`p${i + 1}`, v])), limit },
});
```

Avoid paginating relevance-ranked or non-deterministically ordered warehouse
queries; materialize the result first and paginate by stable columns.

### Proxying an upstream HTTP API

The fetcher is just a function — it can call `fetch`. Useful for normalizing
a third-party API's pagination into your own:

```ts
const paginator = createPaginator({
  fetchCursor: async ({ limit, cursor }) => {
    const url = new URL("https://api.example.com/items");
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("starting_after", cursor.id);
    const { data } = await (await fetch(url)).json();
    return { items: data };
  },
  cursor: { fromItem: (item) => ({ id: item.id }) },
});
```

Common third-party param names (map in your fetcher, not in
`parsePaginationParams`):

| Provider style    | forward param      | backward param    |
| ----------------- | ------------------ | ----------------- |
| Stripe-like       | `starting_after`   | `ending_before`   |
| This library REST | `cursor` / `after` | `before`          |
| Relay             | `after` + `first`  | `before` + `last` |

---

## Serving it (backend endpoints)

### REST — `parsePaginationParams` + `toRestEnvelope`

`parsePaginationParams` turns untrusted transport params into a
`PaginationInput`, with defaults, clamping (`maxPageSize: 100` by default —
nobody gets to ask for `?page_size=99999`), and alias support.

```ts
import { tryCatch } from "xtandard";
import { parsePaginationParams, toRestEnvelope } from "xtandard/pagination";

Bun.serve({
  routes: {
    "/api/users": async (req) => {
      const input = parsePaginationParams(new URL(req.url).searchParams, {
        defaultPageSize: 20,
        maxPageSize: 100,
      });
      // tryCatch guards malformed cursor tokens (they throw on decode)
      const [result, error] = await tryCatch(async () => userPaginator.paginate(input));
      if (error) return new Response("Invalid pagination params", { status: 400 });
      return Response.json(toRestEnvelope(result));
      // → { data: [...], meta: { hasNextPage, endCursor, page, totalItems, ... } }
    },
  },
});
```

#### Next.js Route Handler

```ts
import { tryCatch } from "xtandard";
import { parsePaginationParams, toRestEnvelope } from "xtandard/pagination";

export async function GET(req: Request) {
  const input = parsePaginationParams(new URL(req.url).searchParams);
  const [result, error] = await tryCatch(() => userPaginator.paginate(input));
  if (error) return Response.json({ error: "Invalid pagination" }, { status: 400 });
  return Response.json(toRestEnvelope(result));
}
```

#### Hono

```ts
import { Hono } from "hono";
import { tryCatch } from "xtandard";
import { parsePaginationParams, toRestEnvelope } from "xtandard/pagination";

const app = new Hono();
app.get("/api/users", async (c) => {
  const input = parsePaginationParams(c.req.query());
  const [result, error] = await tryCatch(() => userPaginator.paginate(input));
  if (error) return c.json({ error: "Invalid pagination" }, 400);
  return c.json(toRestEnvelope(result));
});
```

#### tRPC

```ts
import { z } from "zod";
import { parsePaginationParams, toRestEnvelope } from "xtandard/pagination";

listUsers: publicProcedure
  .input(
    z.object({
      page: z.coerce.number().optional(),
      page_size: z.coerce.number().optional(),
      cursor: z.string().optional(),
      limit: z.coerce.number().optional(),
    }),
  )
  .query(async ({ input }) => {
    const paginated = await userPaginator.paginate(parsePaginationParams(input));
    return toRestEnvelope(paginated);
  }),
```

It also accepts plain records (e.g. an already-parsed body):
`parsePaginationParams({ page: "2", per_page: "10" })`.

### `parsePaginationParams` reference

**Style detection** (first match wins):

1. **cursor** — `cursor`, `after`, or `before` present (`before` ⇒ backward)
2. **offset** — `offset` or `skip` present
3. **page** — `page` present
4. **fallback** — `options.fallback` (`"page"` default) with defaults

**Param aliases:**

| Role         | Accepted keys                                          |
| ------------ | ------------------------------------------------------ |
| page number  | `page`                                                 |
| page size    | `page_size`, `pageSize`, `per_page`, `perPage`, `size` |
| limit        | `limit`, `take`, `first`, `last`                       |
| offset       | `offset`, `skip`                                       |
| cursor token | `cursor`, `after` (forward), `before` (backward)       |
| direction    | `direction=backward` (with `cursor`/`after`)           |

**Options** (`ParsePaginationParamsOptions`):

| Option            | Default  | Notes                                         |
| ----------------- | -------- | --------------------------------------------- |
| `defaultPageSize` | `20`     | when no size param present                    |
| `maxPageSize`     | `100`    | pass `Infinity` to disable clamping           |
| `fallback`        | `"page"` | `"offset"` or `"cursor"` when no style params |

**Behavior notes:**

- Never throws — malformed values (`page=abc`, empty strings) fall back to
  defaults (`page: 1`, `pageSize: defaultPageSize`)
- `page` floors to `1`; `offset` floors to `0`; sizes floor to `1` then clamp
- Record sources accept `string | number | string[]` per key; arrays use the
  first element (`{ page: ["4"], size: ["5", "9"] }` → page 4, size 5)
- `cursor` wins over `offset` and `page` when multiple style params appear
- `before` alone ⇒ backward cursor with default size; `after` alone ⇒ forward
- `first`/`last` double as size params for Relay-style query strings

### GraphQL / Relay — `fromRelayArgs` + `toRelayConnection`

`fromRelayArgs` maps connection args to a cursor input (`first`/`after` →
forward, `last`/`before` → backward). `toRelayConnection` emits a
spec-compliant connection; pass `paginator.cursorFor` so every edge gets its
own cursor:

```ts
import { fromRelayArgs, toRelayConnection } from "xtandard/pagination";

const resolvers = {
  Query: {
    users: async (_parent, args /* { first, after, last, before } */) => {
      const result = await userPaginator.paginate(fromRelayArgs(args, { maxPageSize: 100 }));
      return toRelayConnection(result, paginator.cursorFor);
      // → { edges: [{ node, cursor }], pageInfo: { hasNextPage, ..., endCursor } }
    },
  },
};
```

#### `fromRelayArgs` edge cases

| Args                        | Result                                               |
| --------------------------- | ---------------------------------------------------- |
| `{ first: 10, after: "x" }` | forward, limit 10, cursor `"x"`                      |
| `{ last: 5, before: "y" }`  | backward, limit 5, cursor `"y"`                      |
| `{ before: "y" }`           | backward, default limit (20), cursor `"y"`           |
| `{ last: 5 }`               | backward from end, no cursor                         |
| `{}`                        | forward first page, default limit                    |
| both `last` and `first`     | `last`/`before` wins (backward branch checked first) |

`toRelayConnection(result, cursorFor?)` — `cursorFor` signature is
`(item: T, index: number) => string`. Without it, `edges[].cursor` is `null`
but `pageInfo.startCursor`/`endCursor` from the paginator are still copied.

### With DataLoader

`Paginated<T>` results compose with `createLoader` (from
`xtandard/dataloader`) — paginate the _page of IDs_, batch-load the rows:

```ts
const idPaginator = createPaginator({
  fetchCursor: async ({ limit, cursor }) => ({ items: await fetchIdsAfter(cursor?.id, limit) }),
  cursor: { fromItem: (row) => ({ id: row.id }) },
});

const page = await idPaginator.paginate(input);
const users = await Promise.all(page.items.map((row) => userLoader.load(row.id)));
```

---

## Cursor codecs

Tokens are produced by a two-stage pipeline, every stage replaceable
(signature-compatible with drizzle-cursor, so custom stages can be shared):

```
data ──serializer──▶ string ──encoder──▶ token        default: JSON → base64url
data ◀───parser───── string ◀──decoder── token
```

```ts
import { createCursorCodec } from "xtandard/pagination";

createCursorCodec(); // JSON + base64url (sync)
createCursorCodec({ reviveDates: false }); // skip ISO-string → Date revival on decode
createCursorCodec({ serializer: superjson.stringify, parser: superjson.parse });
createCursorCodec({
  // encrypted cursors — async codec
  encoder: (s) => encryptWithSubtleCrypto(s), // returns Promise<string>
  decoder: (t) => decryptWithSubtleCrypto(t),
});
```

### Standalone codec (no paginator)

```ts
const codec = createCursorCodec<{ id: number }>();
const token = codec.encode({ id: 42 });
const data = codec.decode(token); // { id: 42 }
```

Useful for signing bookmark links, WebSocket resume tokens, or sharing codecs
with drizzle-cursor.

Notes:

- **Dates round-trip by default**: `JSON.stringify` emits ISO strings,
  `decode` revives _top-level_ ISO-looking strings back into `Date`s
  (matching drizzle-cursor). If a cursor field is a string that merely looks
  like a date (a `"2024-06-11"` SKU), pass `reviveDates: false`.
- **`isIsoDateString`** — helper used by the default parser to detect
  ISO-shaped strings for date revival.
- **Opaque ≠ secret.** base64url hides structure from casual eyes but anyone
  can decode it. Don't put sensitive values in cursors, or use an
  encrypting/signing encoder.
- **Malformed tokens throw on decode** (bad base64, garbage JSON). Treat
  cursor params as untrusted input — wrap `paginate` in `try/catch` /
  `tryCatch` at the API boundary and answer 400 (see the REST example).
- An async stage (WebCrypto) makes the codec — and `cursorFor` — Promise
  -returning, tracked in the types (see tiers below).

---

## Security

| Threat                         | Mitigation                                                         |
| ------------------------------ | ------------------------------------------------------------------ |
| huge `?page_size=` / `?limit=` | `parsePaginationParams({ maxPageSize })` + `maxLimit` on paginator |
| cursor tampering               | treat as untrusted; HMAC/sign in `encoder`/`decoder`, or encrypt   |
| sensitive data in cursors      | never — cursors round-trip to clients; use opaque IDs only         |
| deep OFFSET scans              | prefer cursor for public/large tables; cap page number if needed   |

Signing pattern (sketch):

```ts
createCursorCodec({
  encoder: (payload) => sign(payload, SECRET),
  decoder: (token) => {
    const payload = verify(token, SECRET); // throws if tampered
    return JSON.parse(payload);
  },
});
```

---

## Error contract

| Layer                    | Throws? | When                                                       |
| ------------------------ | ------- | ---------------------------------------------------------- |
| `parsePaginationParams`  | never   | malformed input → sane defaults                            |
| `fromRelayArgs`          | never   | missing args → defaults                                    |
| `toOffsetWindow`         | never   | clamps invalid numbers                                     |
| `createPaginator` config | sync    | missing `fetchOffset`/`fetchCursor` for requested style    |
| `cursorFor`              | sync    | no `cursor.fromItem` configured                            |
| `codec.decode`           | sync    | malformed token (bad base64, invalid JSON)                 |
| fetchers                 | your DB | connection errors, syntax errors — propagate as you prefer |

Wrap `paginate` at HTTP boundaries; let `parsePaginationParams` handle garbage
query strings silently.

---

## Sync/async tiers

The paginator is as synchronous as what you pass, per the
[sync/async-adaptive pattern](./sync-async-adaptive.md):

| Config                                 | `paginate()`                 | `cursorFor()`          |
| -------------------------------------- | ---------------------------- | ---------------------- |
| sync fetchers + sync codec             | `Paginated<T>` — no `await`  | `string`               |
| async fetchers + sync codec _(common)_ | `MaybePromise<Paginated<T>>` | `string`               |
| async codec anywhere                   | `MaybePromise<Paginated<T>>` | `MaybePromise<string>` |

`await` works on every tier, so when in doubt, `await` it. Misconfiguration
(asking for a style with no fetcher) throws synchronously in all tiers —
prefer `await`/`try-catch` over `.then().catch()` chains.

### TypeScript: which paginator type?

| You passed                            | Type                     | `paginate` return   |
| ------------------------------------- | ------------------------ | ------------------- |
| all-sync fetchers, sync codec         | `PaginatorSync<T>`       | `Paginated<T>`      |
| async fetchers (or mixed), sync codec | `Paginator<T>`           | `MaybePromise<...>` |
| async codec stage                     | `PaginatorMaybeAsync<T>` | `MaybePromise<...>` |

`TCursor` is inferred from `cursor.fromItem`'s return type — your fetcher
receives `CursorWindow<TCursor>` with the right shape.

---

## Performance

- **Skip `totalItems`** when `COUNT(*)` is expensive — lookahead still gives
  correct `hasNextPage`; you lose `totalPages` (fine for infinite scroll).
- **Deep OFFSET** degrades on large tables — expose cursor pagination for
  feeds; keep offset for shallow admin pages.
- **One-row lookahead** avoids an extra round-trip per page vs `COUNT` + `SELECT`.
- **`pages()` / `items()`** fetch lazily — one query per loop iteration; safe
  to break early.

---

## Iterating everything — `pages()` / `items()`

Every paginator exposes lazy async generators that auto-walk the pagination
for exports, migrations, syncs:

```ts
// page by page — one fetch per loop turn; breaking stops fetching
for await (const page of paginator.pages({ type: "cursor", limit: 500 })) {
  await writeBatch(page.items);
}

// flattened items
for await (const user of paginator.items({ type: "offset", limit: 100, offset: 0 })) {
  await reindex(user);
}

// composes with the iterable utils
const all = await collect(paginator.items({ type: "cursor", limit: 100 }));
for await (const [i, row] of enumerate(paginator.items({ type: "cursor", limit: 100 }))) { ... }
```

- Cursor inputs follow `endCursor` until `hasNextPage` is false (or
  `startCursor`/`hasPreviousPage` with `direction: "backward"` — an
  "everything newer than X" iterator).
- Page/offset inputs advance the offset by the items actually returned, so
  you can start mid-set. Internally, `pages()` rewrites subsequent requests to
  `{ type: "offset", limit, offset: prevOffset + items.length }` — the
  original `page` input shape is not preserved across iterations.
- Two guard rails stop infinite loops from misbehaving fetchers: an empty
  page ends iteration, and so does a cursor that didn't advance.
- Always `AsyncGenerator` (even on a sync paginator) — `for await` handles
  sync pages transparently.

---

## Frontend

### TanStack Query infinite scroll — `infinitePaginationOptions`

A plain-object factory (no dependency on `@tanstack/react-query`, so it lives
in the zero-dep core and works with the React, Vue, Solid, and Svelte
adapters alike):

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import { createPaginator, infinitePaginationOptions } from "xtandard/pagination";

// client-side paginator that calls your API
const apiPaginator = createPaginator({
  fetchCursor: async ({ limit, cursor }) => {
    const url = new URL("/api/posts", location.origin);
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor.token);
    const { data, meta } = await (await fetch(url)).json();
    return { items: data };
  },
  cursor: { fromItem: (post) => ({ token: post.id }) },
});

function Feed() {
  const { data, fetchNextPage, fetchPreviousPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["posts"],
    ...infinitePaginationOptions(apiPaginator, { pageSize: 20 }),
  });
  // data.pages: Paginated<Post>[] — fetchPreviousPage works too (bidirectional)
}
```

**Constraints:**

- Requires a cursor-capable paginator (`fetchCursor` + `cursor` config).
  Offset-only paginators won't work — TanStack infinite queries walk cursors.
- Only `pageSize` is configurable (maps to `limit`); initial param is always
  `null` (first page).
- `queryFn` always issues `{ type: "cursor", ... }` regardless of how your
  REST API names params — map in `fetchCursor`.

`getNextPageParam`/`getPreviousPageParam` are wired from
`pageInfo.endCursor`/`startCursor`, and the `direction` TanStack passes maps
onto backward fetches — so a both-ways feed (scroll down for older, scroll
up for newer) is the default behavior, not extra work.

> Often the simpler client-side shape is: let the **server** own the
> paginator and just forward `meta.endCursor` as the next request's
> `?cursor=`. The client never needs this library for that — the tokens are
> plain strings.

### Classic page-number UI

Have your fetcher report `totalItems` and drive a pager from the envelope:

```tsx
const { items, pageInfo } = await paginator.paginate({ type: "page", page, pageSize: 25 });
// pageInfo: { page: 3, pageSize: 25, totalItems: 612, totalPages: 25, hasNextPage: true, ... }

<Pager
  page={pageInfo.page}
  totalPages={pageInfo.totalPages}
  onNext={() => setPage(page + 1)}
  disabled={{ next: !pageInfo.hasNextPage, prev: !pageInfo.hasPreviousPage }}
/>;
```

### Local data (search results, client-side tables)

The all-sync tier means client-side pagination of an in-memory list needs no
effects, no suspense, no loading states:

```tsx
const paginator = useMemo(
  () =>
    createPaginator({
      fetchOffset: ({ limit, offset }) => ({
        items: filtered.slice(offset, offset + limit),
        totalItems: filtered.length,
      }),
    }),
  [filtered],
);
const { items, pageInfo } = paginator.paginate({ type: "page", page, pageSize: 10 }); // sync, in render
```

---

## Migration

### From hand-rolled `?page=&limit=`

1. Move slice/query logic into `fetchOffset`
2. Replace manual offset math with `parsePaginationParams` + `toRestEnvelope`
3. Add `cursor.fromItem` when you want `meta.endCursor` without cursor fetch yet

### From Relay / graphql-relay

1. Replace `connectionFromArray` (in-memory) with `createPaginator` + DB fetcher
2. Swap arg parsing for `fromRelayArgs`, response shaping for `toRelayConnection`
3. Pass `paginator.cursorFor` as the edge cursor function

### From Prisma `cursor` + `skip: 1` only

Add `fetchOffset` for admin pages; keep your existing `findMany` as
`fetchCursor`. One paginator, both styles.

---

## Testing

Executable specs live in:

- [`test/pagination.test.ts`](../test/pagination.test.ts) — paginator, lookahead,
  backward, `pages()`/`items()`, sync tier, `maxLimit`
- [`test/pagination-params.test.ts`](../test/pagination-params.test.ts) —
  `parsePaginationParams`, `fromRelayArgs`
- [`test/pagination-output.test.ts`](../test/pagination-output.test.ts) —
  REST/Relay/infinite adapters
- [`test/cursor-codec.test.ts`](../test/cursor-codec.test.ts) — encode/decode,
  date revival, custom stages

**Fetcher contract checklist** (mirror these in your integration tests):

- [ ] fetcher returns up to `limit` rows (including lookahead row)
- [ ] `hasNextPage` true when extra row present, false on last page
- [ ] backward fetcher returns flipped order; consumer sees natural order
- [ ] composite cursor `WHERE` matches `ORDER BY` columns + tiebreaker
- [ ] malformed `?cursor=` → 400 at boundary, not 500
- [ ] `maxPageSize` / `maxLimit` clamp honored

---

## API reference

| Export                                              | What it does                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `createPaginator(options)`                          | Build a paginator from `fetchOffset`/`fetchCursor` + optional `cursor` config and `maxLimit` |
| `paginator.paginate(input)`                         | Run any `PaginationInput` → `Paginated<T>`                                                   |
| `paginator.cursorFor(item)`                         | Encode an item's opaque cursor token                                                         |
| `paginator.pages(input)` / `paginator.items(input)` | Lazy `AsyncGenerator`s walking all pages / items                                             |
| `toOffsetWindow(input)`                             | Page/offset input → `{ limit, offset }` (clamps invalid values)                              |
| `createCursorCodec(options?)`                       | Pluggable token codec (serializer/parser + encoder/decoder, `reviveDates`)                   |
| `encodeBase64Url` / `decodeBase64Url`               | The default isomorphic encoder stages                                                        |
| `isIsoDateString`                                   | ISO date string detector for default codec date revival                                      |
| `parsePaginationParams(source, options?)`           | Untrusted query params / records → `PaginationInput` (never throws)                          |
| `fromRelayArgs(args, options?)`                     | `first`/`after`/`last`/`before` → cursor input                                               |
| `toRestEnvelope(result)`                            | → `{ data, meta }`                                                                           |
| `toRelayConnection(result, cursorFor?)`             | → Relay connection; `cursorFor(item, index)` per edge                                        |
| `infinitePaginationOptions(paginator, options?)`    | → TanStack `useInfiniteQuery` config fragment (cursor paginator required)                    |
| `createKeysetSpec(options)`                         | Portable keyset `where()` / `orderBy()` AST for ORM adapters                                 |
| `toKeysetWhereSql(where, columns, options?)`        | Render keyset `WHERE` as parameterized SQL + params                                          |
| `toKeysetOrderBySql(order, columns)`                | Render keyset `ORDER BY` from validated column identifiers                                   |
| `assertSqlIdentifier(identifier)`                   | Validate unquoted SQL identifiers used by raw SQL helpers                                    |

Key types: `PaginationInput`, `Paginated<T>`, `PageInfo`, `OffsetWindow`,
`CursorWindow<TCursor>`, `PaginationFetchResult<T>`, `Paginator<T>` /
`PaginatorSync<T>` / `PaginatorMaybeAsync<T>`, `CursorCodec<T>` /
`CursorCodecMaybeAsync<T>`, `RelayArgs`, `RelayConnection<T>`,
`RestEnvelope<T>`, `InfinitePaginationOptions<T>`,
`ParsePaginationParamsOptions`, `PaginationParamsSource`, `KeysetSpec`,
`KeysetWhere`, `KeysetSortKey`, `KeysetSqlFragment`, `ToKeysetSqlOptions`.

---

## Gotchas & FAQ

**Why can't I use a cursor with `fetchOffset`?** A cursor identifies a value,
not a position — there is no general conversion. Provide `fetchCursor` for
cursor traffic (you can support both styles on one paginator).

**My pages skip/duplicate rows near boundaries.** Your sort isn't
deterministic. Cursor keys must mirror the full `ORDER BY` including a unique
tiebreaker, and the keyset `WHERE` must compare the whole tuple.

**Why does my fetcher get `limit: 21` when I asked for 20?** The one-row
lookahead. Return up to that many rows; the paginator slices to 20 and uses
row 21's existence as `hasNextPage`.

**Backward pages look reversed in my fetcher but correct outside.** By
design: backward fetchers flip the sort, the paginator restores natural
order, so consumers never branch on direction.

**A bad `?cursor=` crashes my route.** Decoding malformed tokens throws —
that's your 400. Wrap the `paginate` call in `tryCatch`/`try-catch` at the
boundary (example in the REST section).

**Do clients need this library to consume my API?** No. Tokens are plain
strings; clients just echo `meta.endCursor` back as `?cursor=`. The library
is useful client-side only when the _client_ owns pagination state (TanStack
infinite queries, local data).

**Where's the React entry?** Not needed — `infinitePaginationOptions` is a
plain object factory in the zero-dep core, compatible with every TanStack
Query adapter.

**Why does `parsePaginationParams` not throw on `page=abc`?** Transport
params are untrusted and often partial — silent defaults are safer than 400s
for missing/malformed page numbers. Cursor decode errors happen later in
`paginate` where you control the response.

**Can I paginate with only `fetchCursor`?** Yes for cursor requests. Page/
offset requests still need `fetchOffset`.
