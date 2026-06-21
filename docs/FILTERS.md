# Filters (`@xtandard/lib/filters`)

One typed filter system that spans **frontend ↔ API ↔ any query builder** —
built like [`pagination`](./PAGINATION.md): a **portable core** lowers a request
to a driver-agnostic AST, and thin **per-driver adapters** render it.

- **Core** — `@xtandard/lib/filters`. Plain TS types + `compileFilters`. **No
  validation library, no driver.**
- **Validation (optional)** — `@xtandard/lib/filters/valibot` (ready-made valibot
  schemas). Or validate with any Standard Schema (zod/arktype/effect/…).
- **Adapters** — `@xtandard/lib/filters/{drizzle,kysely,knex,mongo,prisma}`.

## The model (types only)

The model is a two-level discriminated union (plain TS types — `./types.ts`):

- **outer `kind`** — `text` / `number` / `enum` / `boolean` / `date` / `array`.
- **inner `operator`** — the argument shape, Drizzle-aligned: scalar
  (`eq`/`ne`/`lt`/`gt`/`lte`/`gte`), text-match
  (`contains`/`startsWith`/`endsWith`/`like`/`ilike`/`notIlike`), range
  (`between`/`notBetween`), set (`inArray`/`notInArray`), array
  (`arrayContains`/`arrayContained`/`arrayOverlaps`), unary (`isNull`/`isNotNull`),
  and the `date` **preset** (`is`/`before`/`after`/`between` over a unit).

A request is a flat AND list (`ColumnFilter[]` / `FiltersRequest`) or a recursive
`FilterNode` tree (`and`/`or`/`not`). `Sort` is a `{ field, dir }[]`.

## Validation — bring your own

The core consumes plain typed objects, so you can validate the incoming request
with **whatever you use** and pass the result straight to `compileFilters` / an
adapter's `buildWhere`:

```ts
// valibot (the optional ready-made schemas)
import { FiltersRequestSchema } from "@xtandard/lib/filters/valibot";
import * as v from "valibot";
const filters = v.parse(FiltersRequestSchema, input);

// or zod / arktype / effect — validate into the same `ColumnFilter[]` shape and
// pass it in; @xtandard/lib/filters never imports a validation library.
```

`@xtandard/lib/filters/valibot` exports `FieldFilterSchema`, `ColumnFilterSchema`,
`FiltersRequestSchema`, `FilterNodeSchema`, `SortSchema`, `DatePresetSchema`. A
`*.test-d.ts` asserts their output equals the model types (no drift). Peers:
`valibot` + `@js-temporal/polyfill` (the `date` preset's anchor is a
`Temporal.PlainDateTime` string; the timezone is IANA-validated).

## The portable compiler

`compileFilters({ spec, filters, resolveDate })` → `{ where: CompiledWhere | null }`.
`spec` is the per-field **kind allow-list** (`Record<field, FieldKind>`); a field
not in `spec`, or whose filter kind mismatches, is dropped. `CompiledWhere` is an
`and`/`or`/`not` tree of normalized leaf conditions (`{ field, op, value/… }`).

Lowering rules: the `date` preset is resolved to `gte`/`lt` (`Date` bounds) via
the injected `resolveDate`; text-match ops stay **semantic** (each adapter
renders `contains`→`ilike`/`$regex`/`contains`-mode natively).

You rarely call `compileFilters` directly — the adapters do, via their typed
spec. It's exported for writing your own adapter.

## The `date` kind is injected

A `date` preset (e.g. "this month in America/Los_Angeles") resolves to a
half-open `[gte, lt)` instant window. That resolution — and the human label —
are app-specific, so they're **injected** rather than bundling a date library:

```ts
type DateFilterResolver = (input: { value: DatePreset }) => {
  start: Date | null;
  end: Date | null;
};
```

Pass `resolveDate` to any adapter's `buildWhere` (a `date` preset without it
throws); pass `describeDate` to `describeFieldFilter` for chip labels. demi.casa
wires its `@demi.casa/time` `resolveDateFilter` / `describeDateSelectorValue`.

## Adapters

Every adapter exposes typed `dateField`/`textField`/`numberField`/`enumField`/
`booleanField`/`arrayField` spec builders (the allow-list + column/path mapping)
and `buildWhere` / `buildFilterNode`. They share the same model + compiler, so
the only difference is the column reference and the WHERE representation.

### Drizzle (`/drizzle`, peer `drizzle-orm`)

```ts
import { buildWhere, textField, numberField, dateField } from "@xtandard/lib/filters/drizzle";

const spec = {
  name: textField({ column: t.name }), // ColumnOf<string> — a kind↔column mismatch is a compile error
  amount: numberField({ column: t.amount }),
  createdAt: dateField({ column: t.createdAt }),
};
const { where } = buildWhere({ spec, filters, resolveDate });
db.select().from(t).where(where);
```

Also `buildOrderBy({ sort, columns, defaultSort })` and `createDrizzleKeyset`
(cursor seek, rendered from the portable `@xtandard/lib/pagination` keyset).

### Kysely (`/kysely`, peer `kysely`)

`textField({ column: "posts.name" })` (a `sql.ref`) or a `sql` `RawBuilder`.
`buildWhere(...)` → `RawBuilder<SqlBool> | undefined`; `buildOrderBy(...)` →
order expressions. PostgreSQL flavor (`ilike`, array `@>`/`<@`/`&&`).

### Knex (`/knex`, no driver dep)

`textField({ column: "name" })` (server-owned identifier, validated).
`buildWhereSql(...)` → `{ sql, bindings }` (parameterized, `?`); or
`applyFiltersToKnex(query, { spec, filters, resolveDate })` via `whereRaw`.

### Mongo (`/mongo`, no driver dep)

`textField({ path: "name" })`. `buildFilter(...)` → a plain Mongo filter object
(text → `$regex`, `between` → `$gte`/`$lte`, `inArray` → `$in`, `and`/`or`/`not`
→ `$and`/`$or`/`$nor`).

### Prisma (`/prisma`, no driver dep)

`textField({ field: "name" })`. `buildWhere(...)` → a plain Prisma `where`
object (text → `contains`/`startsWith`/`endsWith` with `mode: "insensitive"`,
`between` → `gte`/`lte`, `inArray` → `in`, array → `hasEvery`/`hasSome`).

### Cross-driver caveats (documented limitations)

The model is PostgreSQL-leaning. Where an op has no faithful native equivalent
the adapter **throws a clear error** rather than emitting something wrong:

- Mongo/Prisma `arrayContained` (array ⊆ values) — no native operator.
- Prisma `like`/`ilike`/`notIlike` (arbitrary `%`/`_` patterns) — use
  `contains`/`startsWith`/`endsWith` instead.
- Mongo maps `like`→case-sensitive regex, `ilike`→case-insensitive, by
  translating the SQL `LIKE` pattern (`%`→`.*`, `_`→`.`).

## Frontend helpers

`@xtandard/lib/filters` also re-exports the frontend-safe pieces — `*_OPERATORS`
/ `OPERATORS_BY_KIND` (UI operator pickers), `parseSortParam` / `serializeSort`,
`describeFieldFilter` / `describeColumnFilter` (chip labels; `date` label
injected), `ResourceMetadata` / `FieldMetadata` (a serializable `…/_metadata`
contract), and the `@xtandard/lib/pagination` request helpers
(`parsePaginationParams`, `fromRelayArgs`, `toRelayConnection`, …).
