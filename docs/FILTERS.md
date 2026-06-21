# Filters

A typed, end-to-end filtering system: one model spans **frontend ↔ API ↔ any
query builder**. Built like [`pagination`](./PAGINATION.md) — a **portable core**
lowers a request into a driver-agnostic AST, and thin **per-driver adapters**
render it (Drizzle, Kysely, Knex, Mongo, Prisma, or your own).

- The **core** (`@xtandard/lib/filters`) is **validation-library-free** and
  **driver-free**: plain TS types + `compileFilters`.
- **Validation is optional and pluggable**: ready-made valibot schemas at
  `@xtandard/lib/filters/valibot`, or validate with any Standard Schema
  (zod/arktype/effect/…) into the same shape.
- The **`date` kind is injected** (no date library is bundled).

```bash
npm install @xtandard/lib
# + whichever adapter peer you use: drizzle-orm | kysely | (knex/mongo/prisma need no peer)
# + valibot for the optional ready-made schemas
```

## Quick start

```ts
import * as v from "valibot";
import { FiltersRequestSchema } from "@xtandard/lib/filters/valibot";
import { buildWhere, textField, numberField, dateField } from "@xtandard/lib/filters/drizzle";

// 1. validate the untrusted request (any validator works — here, the ready-made schema)
const filters = v.parse(FiltersRequestSchema, [
  { field: "name", filter: { kind: "text", operator: "contains", value: "ada" } },
  { field: "amount", filter: { kind: "number", operator: "between", from: 10, to: 100 } },
]);

// 2. declare a per-resource allow-list (public field → column + kind)
const spec = {
  name: textField({ column: users.name }),
  amount: numberField({ column: users.amount }),
  createdAt: dateField({ column: users.createdAt }),
};

// 3. build the WHERE and query
const { where } = buildWhere({ spec, filters, resolveDate });
const rows = await db.select().from(users).where(where);
```

To target another store, change only the adapter import (`/drizzle` →
`/kysely` `/knex` `/mongo` `/prisma`) and the column reference in the spec.

## The model

A filter request is built from `ColumnFilter`s — a public **field** name + a
**`FieldFilter`**. `FieldFilter` is a two-level discriminated union:

- **outer `kind`** — the column data kind: `text` · `number` · `enum` ·
  `boolean` · `date` · `array`.
- **inner `operator`** — the argument shape within that kind.

```ts
type ColumnFilter = { field: string; filter: FieldFilter };
type FiltersRequest = ColumnFilter[]; // flat AND list (the common case)
```

### Operators by kind

Operators are **Drizzle-aligned** and grouped by argument shape:

| Group       | Operators                                                    | Argument                                 |
| ----------- | ------------------------------------------------------------ | ---------------------------------------- |
| scalar      | `eq` `ne` `lt` `gt` `lte` `gte`                              | `value`                                  |
| text-match  | `contains` `startsWith` `endsWith` `like` `ilike` `notIlike` | `value` (string)                         |
| range       | `between` `notBetween`                                       | `from` + `to`                            |
| set         | `inArray` `notInArray`                                       | `values[]`                               |
| array (PG)  | `arrayContains` `arrayContained` `arrayOverlaps`             | `values[]`                               |
| unary       | `isNull` `isNotNull`                                         | —                                        |
| date preset | `is` `before` `after` `between`                              | `unit` + `timeZone` + `anchor` (+ `end`) |

Which operators each kind accepts:

| kind      | operators                                     |
| --------- | --------------------------------------------- |
| `text`    | scalar (`eq`/`ne`) + text-match + set + unary |
| `number`  | scalar + range + set + unary                  |
| `enum`    | `eq`/`ne` + set + unary                       |
| `boolean` | `eq`/`ne` + unary                             |
| `date`    | date preset + unary                           |
| `array`   | array (PG) + unary                            |

`OPERATORS_BY_KIND` and the `*_OPERATORS` constants (e.g. `TEXT_OPERATORS`,
`NUMBER_OPERATORS`) expose these lists for building UI operator pickers.

### Examples of each kind

```ts
// text
{ field: "name",   filter: { kind: "text",    operator: "contains",  value: "ada" } }
{ field: "name",   filter: { kind: "text",    operator: "inArray",   values: ["a", "b"] } }
{ field: "name",   filter: { kind: "text",    operator: "isNull" } }
// number
{ field: "amount", filter: { kind: "number",  operator: "gte",       value: 10 } }
{ field: "amount", filter: { kind: "number",  operator: "between",   from: 10, to: 100 } }
// enum / boolean
{ field: "status", filter: { kind: "enum",    operator: "inArray",   values: ["open", "done"] } }
{ field: "active", filter: { kind: "boolean", operator: "eq",        value: true } }
// array (Postgres array column)
{ field: "tags",   filter: { kind: "array",   operator: "arrayContains", values: ["x", "y"] } }
// date — a DST-aware period preset (resolved to a half-open instant window)
{ field: "createdAt", filter: { kind: "date", operator: "is", unit: "month",
                                timeZone: "America/Los_Angeles", anchor: "2026-02-01T00:00:00" } }
```

### Composition: `and` / `or` / `not`

The flat list ANDs its entries. For arbitrary boolean trees use `FilterNode`:

```ts
import type { FilterNode } from "@xtandard/lib/filters";

const node: FilterNode = {
  type: "and",
  nodes: [
    { type: "column", field: "status", filter: { kind: "enum", operator: "eq", value: "open" } },
    {
      type: "not",
      node: {
        type: "or",
        nodes: [
          {
            type: "column",
            field: "name",
            filter: { kind: "text", operator: "startsWith", value: "tmp" },
          },
          { type: "column", field: "amount", filter: { kind: "number", operator: "lt", value: 0 } },
        ],
      },
    },
  ],
};
// every adapter has a `buildFilterNode` (or `buildFilterNodeSql`) counterpart.
```

## Validation — bring your own

The core consumes **plain typed objects**, so validate the incoming request with
whatever you already use, then pass the result to an adapter's `buildWhere`:

```ts
// valibot — the ready-made schemas (peer: valibot + @js-temporal/polyfill)
import { FiltersRequestSchema, FilterNodeSchema, SortSchema } from "@xtandard/lib/filters/valibot";
import * as v from "valibot";
const filters = v.parse(FiltersRequestSchema, await req.json());

// zod / arktype / effect — write a schema for the same `ColumnFilter[]` shape and
// pass its output in. @xtandard/lib/filters never imports a validation library.
```

`@xtandard/lib/filters/valibot` exports `FieldFilterSchema`, `ColumnFilterSchema`,
`FiltersRequestSchema`, `FilterNodeSchema`, `SortSchema`, `SortItemSchema`,
`DatePresetSchema`, and the per-kind variant schemas. A `*.test-d.ts` asserts
each schema's output **equals** the model type (no drift). The `date` preset's
`anchor`/`end` are validated as `Temporal.PlainDateTime` strings and `timeZone`
as an IANA id.

## The `date` kind is injected

A `date` preset (e.g. "this month in `America/Los_Angeles`") resolves to a
half-open `[gte, lt)` **instant window**. That DST-aware resolution — and the
human chip label — are app-specific, so they are **injected** rather than
bundling a date library:

```ts
type DateFilterResolver = (input: { value: DatePreset }) => {
  start: Date | null; // inclusive lower bound (→ gte)
  end: Date | null; //   exclusive upper bound (→ lt)
};
```

Pass `resolveDate` to any adapter's `buildWhere`/`buildFilterNode` — a `date`
**preset** filter without it throws (a bare `date` `isNull`/`isNotNull` needs
nothing). For chip labels, pass `describeDate` to `describeFieldFilter`. (In
demi.casa, both come from `@demi.casa/time`: `resolveDateFilter` /
`describeDateSelectorValue`.)

> The `date` preset is the only place we use timezone-aware date math, and it is
> always rendered as **half-open `>= start AND < end`** — never SQL `BETWEEN`,
> whose inclusive upper bound double-counts the boundary
> ([PG: Don't Do This](https://wiki.postgresql.org/wiki/Don't_Do_This)).

## The portable compiler

Adapters call the core compiler for you, but you can use it directly to write a
new adapter:

```ts
import { compileFilters, compileFilterNode } from "@xtandard/lib/filters";

const { where } = compileFilters({
  spec: { status: "enum", amount: "number" }, // field → kind allow-list
  filters,
  resolveDate, // required iff a `date` preset is present
});
// where: CompiledWhere | null  — an and/or/not tree of normalized leaf conditions
```

Lowering rules (uniform across every adapter):

- A field **not in `spec`**, or whose filter `kind` **mismatches** the spec, is
  **dropped**.
- `date` preset → `gte` + `lt` (resolved `Date`s).
- `between` → `gte AND lte`; `notBetween` → `lt OR gt`. **No adapter emits SQL
  `BETWEEN`.**
- Text-match ops (`contains`/`ilike`/…) stay **semantic** in the AST so each
  adapter renders them natively (SQL `ILIKE`, Mongo `$regex`, Prisma
  `contains`-mode).

`CompiledWhere` shape:

```ts
type CompiledWhere =
  | { type: "cond"; cond: CompiledCond }
  | { type: "and"; nodes: CompiledWhere[] }
  | { type: "or"; nodes: CompiledWhere[] }
  | { type: "not"; node: CompiledWhere };
```

## Adapters

Every adapter exposes typed `dateField`/`textField`/`numberField`/`enumField`/
`booleanField`/`arrayField` **spec builders** (the allow-list + column/path
mapping) and `buildWhere` / `buildFilterNode`. They differ only in the column
reference type and the WHERE representation.

### Drizzle — `@xtandard/lib/filters/drizzle` (peer `drizzle-orm`)

The spec builders constrain the column by its SELECT type, so a kind↔column
mismatch is a **compile error** (`dateField` needs `ColumnOf<Date>`, etc.).

```ts
import {
  buildWhere,
  buildOrderBy,
  createDrizzleKeyset,
  dateField,
  textField,
  numberField,
  enumField,
} from "@xtandard/lib/filters/drizzle";

const spec = {
  name: textField({ column: tasks.name }),
  status: enumField({ column: tasks.status }),
  amount: numberField({ column: tasks.amount }),
  createdAt: dateField({ column: tasks.createdAt }),
};

const { where } = buildWhere({ spec, filters, resolveDate });
const { orderBy } = buildOrderBy({
  sort,
  columns: { name: tasks.name, createdAt: tasks.createdAt },
});

const rows = await db
  .select()
  .from(tasks)
  .where(where)
  .orderBy(...orderBy);
```

For cursor pagination, `createDrizzleKeyset({ sort, columns })` returns
`keys()`/`orderBy()`/`where()` (rendered from the portable `@xtandard/lib/pagination`
keyset, avoiding the `^0.45` `drizzle-orm` peer of `pagination/drizzle`), and
`combineWhere(...)` ANDs the filter WHERE with the keyset seek. Use
`toDrizzleWhere({ where, columns })` to render a pre-compiled AST directly.

### Kysely — `@xtandard/lib/filters/kysely` (peer `kysely`)

Columns are string references (passed to `sql.ref`) or `sql` `RawBuilder`s.
PostgreSQL flavor (`ilike`, array `@>`/`<@`/`&&`).

```ts
import { buildWhere, buildOrderBy, textField, dateField } from "@xtandard/lib/filters/kysely";

const spec = {
  name: textField({ column: "tasks.name" }),
  createdAt: dateField({ column: "tasks.created_at" }),
};

let q = db.selectFrom("tasks").selectAll();
const { where } = buildWhere({ spec, filters, resolveDate });
if (where) q = q.where(where);
for (const o of buildOrderBy({ sort, columns: { name: "tasks.name" } }).orderBy) q = q.orderBy(o);
```

### Knex — `@xtandard/lib/filters/knex` (no driver dependency)

Renders raw, **parameterized** SQL (`?` bindings); column identifiers are
server-owned and validated (`col` or `table.col`, quoted per part).

```ts
import {
  applyFiltersToKnex,
  buildWhereSql,
  textField,
  numberField,
} from "@xtandard/lib/filters/knex";

const spec = { name: textField({ column: "name" }), amount: numberField({ column: "amount" }) };

// apply directly:
const rows = await applyFiltersToKnex(knex("tasks"), { spec, filters, resolveDate });
// or get the fragment:
const fragment = buildWhereSql({ spec, filters, resolveDate }); // { sql, bindings } | null
if (fragment) query.whereRaw(fragment.sql, fragment.bindings);
```

### Mongo / Mongoose — `@xtandard/lib/filters/mongo` (no driver dependency)

Returns a plain Mongo filter object. Columns are dotted paths.

```ts
import { buildFilter, textField, numberField, dateField } from "@xtandard/lib/filters/mongo";

const spec = {
  name: textField({ path: "name" }),
  amount: numberField({ path: "amount" }),
  createdAt: dateField({ path: "createdAt" }),
};
const { filter } = buildFilter({ spec, filters, resolveDate });
const docs = await collection.find(filter ?? {}).toArray();
```

Mapping: scalar → `$eq`/`$ne`/`$lt`/…; text → `$regex` (`like`/`ilike` translate
the SQL pattern to a regex); set → `$in`/`$nin`; `arrayContains` (`@>`) → `$all`,
`arrayOverlaps` (`&&`) → `$in`, `arrayContained` (`<@`) →
`{ $expr: { $setIsSubset: ["$path", values] } }`; `and`/`or`/`not` →
`$and`/`$or`/`$nor`; `isNull` → `{ $eq: null }`.

### Prisma — `@xtandard/lib/filters/prisma` (no driver dependency)

Returns a plain Prisma `where` object. Columns are field names.

```ts
import { buildWhere, textField, numberField } from "@xtandard/lib/filters/prisma";

const spec = { name: textField({ field: "name" }), amount: numberField({ field: "amount" }) };
const { where } = buildWhere({ spec, filters, resolveDate });
const rows = await prisma.task.findMany({ where });
```

Mapping: scalar → `equals`/`not`/`lt`/…; text → `contains`/`startsWith`/`endsWith`
with `mode: "insensitive"`; set → `in`/`notIn`; array → `hasEvery` (`@>`) /
`hasSome` (`&&`); `and`/`or`/`not` → `AND`/`OR`/`NOT`.

**Limitations (throw with a clear message):** Prisma's `where` has no raw LIKE,
so `like`/`ilike`/`notIlike` reduce to `contains`/`startsWith`/`endsWith` when
the pattern allows (`%x%`/`x%`/`%x`); patterns with internal `%`/`_` throw (use
`$queryRaw`). `arrayContained` has no Prisma operator and throws.

### Operator support matrix

| op                                      | drizzle  |  kysely  |   knex   |       mongo       |        prisma        |
| --------------------------------------- | :------: | :------: | :------: | :---------------: | :------------------: |
| scalar, set, unary                      |    ✅    |    ✅    |    ✅    |        ✅         |          ✅          |
| `between`/`notBetween` (→ half-open)    |    ✅    |    ✅    |    ✅    |        ✅         |          ✅          |
| `contains`/`startsWith`/`endsWith`      | ✅ ILIKE | ✅ ILIKE | ✅ ILIKE |     ✅ regex      |       ✅ mode        |
| `like`/`ilike`/`notIlike` (raw pattern) |    ✅    |    ✅    |    ✅    |     ✅ regex      | ⚠️ reduced or throws |
| `arrayContains` (`@>`)                  |    ✅    |    ✅    |    ✅    |     ✅ `$all`     |    ✅ `hasEvery`     |
| `arrayOverlaps` (`&&`)                  |    ✅    |    ✅    |    ✅    |     ✅ `$in`      |     ✅ `hasSome`     |
| `arrayContained` (`<@`)                 |    ✅    |    ✅    |    ✅    | ✅ `$setIsSubset` |      ❌ throws       |
| date preset (→ gte/lt)                  |    ✅    |    ✅    |    ✅    |        ✅         |          ✅          |

> **The `array` kind is PostgreSQL-specific.** The SQL adapters emit the PG array
> operators `@>` / `<@` / `&&`, which require a real Postgres `array` column.
> **MySQL/SQLite have no native array type** (lists are modeled as JSON) — these
> adapters do not emit `JSON_CONTAINS` (MySQL) / `json_each` (SQLite) equivalents,
> so don't use the `array` kind there. For a JSON-list column on MySQL/SQLite,
> model it differently (e.g. a join table) or write that predicate by hand.

## Sorting

`Sort` is a `{ field, dir }[]`. Parse the compact query form and render it
allow-listed to columns (the SQL adapters expose `buildOrderBy`):

```ts
import { parseSortParam, serializeSort } from "@xtandard/lib/filters";

const { sort } = parseSortParam({ value: "createdAt:desc,name:asc" }); // unknown/malformed dropped
serializeSort({ sort }); // "createdAt:desc,name:asc"

// drizzle / kysely:
const { orderBy } = buildOrderBy({
  sort,
  columns,
  defaultSort: [{ field: "createdAt", dir: "desc" }],
});
db.select()
  .from(t)
  .orderBy(...orderBy);
```

> Use `buildOrderBy` with `db.select(...).orderBy(...)`, **not** the RQB query —
> RQB aliases the root table and breaks column-referencing SQL.

## Describing filters (chip labels)

`describeFieldFilter` / `describeColumnFilter` render short, human labels for
active-filter chips (frontend-safe, no drizzle). The `date` preset's label is
**injected** (`describeDate`) — without it, a preset falls back to its operator
label:

```ts
import { describeColumnFilter } from "@xtandard/lib/filters";

describeColumnFilter({
  columnFilter: {
    field: "amount",
    filter: { kind: "number", operator: "between", from: 1, to: 9 },
  },
  label: "Amount",
}); // "Amount between 1 – 9"

describeColumnFilter({
  columnFilter: { field: "createdAt", filter: datePreset },
  label: "Created",
  describeDate: (f) => formatPreset(f), // your DST-aware label
}); // "Created Feb 2026"
```

## Resource metadata (backend-driven UIs)

`ResourceMetadata` / `FieldMetadata` are a serializable contract a backend can
expose (e.g. at `…/_metadata`) so a frontend renders a filter bar with no
hand-written field defs:

```ts
import type { ResourceMetadata } from "@xtandard/lib/filters";
import { OPERATORS_BY_KIND } from "@xtandard/lib/filters";

const metadata: ResourceMetadata = {
  name: "tasks",
  fields: [
    {
      field: "name",
      label: "Name",
      kind: "text",
      filterable: true,
      sortable: true,
      operators: [...OPERATORS_BY_KIND.text],
    },
    {
      field: "status",
      label: "Status",
      kind: "enum",
      filterable: true,
      sortable: false,
      operators: [...OPERATORS_BY_KIND.enum],
      options: [{ value: "open", label: "Open" }],
    },
  ],
  defaultSort: [{ field: "createdAt", dir: "desc" }],
  pagination: { styles: ["offset", "cursor"] },
  crud: { read: true, create: true, update: true, delete: false },
};
```

## End-to-end: a REST list endpoint

Validation + filters + sort + pagination, all from `@xtandard/lib`:

```ts
import * as v from "valibot";
import { FiltersRequestSchema } from "@xtandard/lib/filters/valibot";
import { parseSortParam, parsePaginationParams, toRestEnvelope } from "@xtandard/lib/filters";
import {
  buildWhere,
  buildOrderBy,
  dateField,
  textField,
  enumField,
} from "@xtandard/lib/filters/drizzle";

const spec = {
  name: textField({ column: tasks.name }),
  status: enumField({ column: tasks.status }),
  createdAt: dateField({ column: tasks.createdAt }),
};
const columns = { name: tasks.name, status: tasks.status, createdAt: tasks.createdAt };

export async function listTasks(req: Request) {
  const url = new URL(req.url);
  const filters = v.parse(
    FiltersRequestSchema,
    JSON.parse(url.searchParams.get("filters") ?? "[]"),
  );
  const { sort } = parseSortParam({ value: url.searchParams.get("sort") });
  const page = parsePaginationParams(url.searchParams);

  const { where } = buildWhere({ spec, filters, resolveDate });
  const { orderBy } = buildOrderBy({
    sort,
    columns,
    defaultSort: [{ field: "createdAt", dir: "desc" }],
  });

  const items = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(...orderBy)
    .limit(page.pageSize ?? 20);
  return Response.json(
    toRestEnvelope({ items, pageInfo: { hasNextPage: false, hasPreviousPage: false } }),
  );
}
```

GraphQL works the same way — validate the input args, then `buildWhere` +
`fromRelayArgs`/`toRelayConnection` from `@xtandard/lib/filters` (re-exported from
`@xtandard/lib/pagination`). See [docs/PAGINATION.md](./PAGINATION.md) for the
pagination half.

## Writing your own adapter

Call `compileFilters` and walk the `CompiledWhere` AST. A minimal sketch:

```ts
import { compileFilters, type CompiledWhere } from "@xtandard/lib/filters";

function render(node: CompiledWhere): MyWhere {
  switch (node.type) {
    case "cond":
      return myLeaf(node.cond); // { field, op, value/values/from/to }
    case "and":
      return myAnd(node.nodes.map(render));
    case "or":
      return myOr(node.nodes.map(render));
    case "not":
      return myNot(render(node.node));
  }
}

export function buildWhere(input: {
  spec: Record<string, FieldKind>;
  filters: ColumnFilter[];
  resolveDate?: DateFilterResolver;
}) {
  const { where } = compileFilters(input);
  return where ? render(where) : undefined;
}
```

The AST already resolves dates, lowers `between`, and drops non-allow-listed
fields, so an adapter only maps the ~16 normalized leaf ops + and/or/not.

## Security

- **Allow-list by spec.** Clients send public field names; only fields present
  in the spec (with a matching kind) are emitted — never a client-supplied
  column. Unknown fields are silently dropped.
- **Server-owned identifiers.** Adapter column references (Drizzle/Kysely
  columns, Knex identifier strings, Mongo paths, Prisma fields) come from your
  code, not request data. Knex validates identifiers and **throws** on anything
  outside `col` / `table.col`.
- **Parameterized values.** Every value is bound (Drizzle/Kysely SQL params,
  Knex `?`, Mongo/Prisma object values) — no string interpolation of user input.
- **Validate the request shape** (valibot or your validator) before building.

## API reference

### `@xtandard/lib/filters` (core, zero deps)

- **Model types:** `FieldKind`, `FieldFilter`, `TextFilter`, `NumberFilter`,
  `EnumFilter`, `BooleanFilter`, `DateFilter`, `DatePreset`, `DateUnit`,
  `ArrayFilter`, `ColumnFilter`, `FiltersRequest`, `FilterNode`, `Sort`,
  `SortItem`, `SortDirection`, `FieldKindSpec`, `ScalarValue`.
- **Compiled AST:** `CompiledWhere`, `CompiledCond`, `CompiledOp`, `TextMatchOp`.
- **Compiler:** `compileFilters`, `compileFilterNode`, `DateFilterResolver`,
  `escapeLike`, `sqlTextOp`.
- **Operators:** `OPERATORS_BY_KIND` and the `*_OPERATORS` constants +
  `*Operator` types.
- **Sort:** `parseSortParam`, `serializeSort`.
- **Describe:** `describeFieldFilter`, `describeColumnFilter`, `DescribeDate`.
- **Resource metadata:** `ResourceMetadata`, `FieldMetadata`, `FieldOption`,
  `ResourceCrud`, `PaginationStyle`.
- **Pagination re-exports:** `parsePaginationParams`, `fromRelayArgs`,
  `toRelayConnection`, `toRestEnvelope`, `infinitePaginationOptions` (+ types).

### `@xtandard/lib/filters/valibot` (peer `valibot`, `@js-temporal/polyfill`)

`FieldFilterSchema`, `TextFilterSchema`, `NumberFilterSchema`, `EnumFilterSchema`,
`BooleanFilterSchema`, `DateFilterSchema`, `DatePresetSchema`, `ArrayFilterSchema`,
`ColumnFilterSchema`, `FiltersRequestSchema`, `FilterNodeSchema`, `SortItemSchema`,
`SortSchema`.

### Adapters

| Entry      | Peer          | Key exports                                                                                                                                                    |
| ---------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/drizzle` | `drizzle-orm` | `buildWhere`, `buildFilterNode`, `toDrizzleWhere`, `buildOrderBy`, `createDrizzleKeyset`, `combineWhere`, `dateField`/…, `FieldSpec`, `FilterSpec`, `ColumnOf` |
| `/kysely`  | `kysely`      | `buildWhere`, `buildFilterNode`, `buildOrderBy`, `toKyselyWhere`, `dateField`/…, `KyselyFilterSpec`                                                            |
| `/knex`    | —             | `buildWhereSql`, `buildFilterNodeSql`, `applyFiltersToKnex`, `toFilterWhereSql`, `dateField`/…, `KnexFilterSpec`                                               |
| `/mongo`   | —             | `buildFilter`, `buildFilterNode`, `toMongoFilter`, `dateField`/…, `MongoFilterSpec`, `MongoFilter`                                                             |
| `/prisma`  | —             | `buildWhere`, `buildFilterNode`, `toPrismaWhere`, `dateField`/…, `PrismaFilterSpec`, `PrismaWhere`                                                             |

## Gotchas & FAQ

- **A `date` preset throws.** Pass `resolveDate` — the DST-aware date→instant
  resolution is injected (a bare `date` `isNull`/`isNotNull` needs nothing).
- **`between` isn't SQL `BETWEEN`.** It lowers to `>= AND <=` (and `notBetween`
  to `< OR >`) on purpose — semantically identical, and avoids the inclusive-
  upper-bound footgun. The model operator is unchanged.
- **Prisma `like` throws on some patterns.** Internal `%`/`_` can't be expressed
  in a Prisma `where` — reduce to `contains`/`startsWith`/`endsWith`, or use
  `$queryRaw`.
- **A filter "disappeared".** Its field isn't in the spec, or its kind doesn't
  match the spec's kind — it was dropped (by design; never trust client fields).
- **Array ops are Postgres-only on SQL adapters.** `@>`/`<@`/`&&` need a PG
  `array` column — they break on **MySQL/SQLite** (no native array type; lists
  there are JSON, which these adapters don't target). Mongo/Prisma approximate
  (`$all`/`$setIsSubset`/`hasEvery`/…); Prisma's `arrayContained` throws.
- **Frontend bundle stays lean.** Import only `@xtandard/lib/filters` (types +
  compile + describe, zero deps) on the client; keep the adapter import on the
  server.

```

```
