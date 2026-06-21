# Filters (`@xtandard/lib/filters`)

One typed filter system that spans **frontend ↔ API ↔ Drizzle**. The model is
the source of truth (valibot → types via `v.InferOutput`, no casts); the Drizzle
subpath compiles a request into a parameterized `WHERE`.

> Peers: `valibot` for the root entry (frontend-safe, no drizzle);
> `drizzle-orm` + `ts-pattern` for `@xtandard/lib/filters/drizzle`. Both optional.

## The model (`@xtandard/lib/filters`)

A two-level discriminated union:

- **outer `kind`** — the column data kind: `text` / `number` / `enum` /
  `boolean` / `date` / `array`.
- **inner `operator`** — the argument shape within a kind, **Drizzle-aligned**:
  scalar (`eq`/`ne`/`lt`/`gt`/`lte`/`gte`/`like`/`ilike`/`notIlike`/`contains`/
  `startsWith`/`endsWith`), range (`between`/`notBetween`), set
  (`inArray`/`notInArray`), array (`arrayContains`/`arrayContained`/
  `arrayOverlaps`), unary (`isNull`/`isNotNull`), and the `date` **preset**
  (`is`/`before`/`after`/`between` over a unit).

```ts
import * as v from "valibot";
import { FieldFilterSchema, FiltersRequestSchema, FilterNodeSchema } from "@xtandard/lib/filters";

// Validate an untrusted request (parse → typed discriminated union, no cast):
const filters = v.parse(FiltersRequestSchema, [
  { field: "status", filter: { kind: "enum", operator: "inArray", values: ["open", "done"] } },
  { field: "amount", filter: { kind: "number", operator: "between", from: 10, to: 100 } },
]);
```

`FiltersRequestSchema` is the flat AND-combined list (the common case);
`FilterNodeSchema` is the recursive `and`/`or`/`not` tree for composition.

Also in the root entry (all frontend-safe):

- `*_OPERATORS` + `OPERATORS_BY_KIND` — the operator vocabulary per kind, for UI
  pickers.
- `parseSortParam` / `serializeSort` — compact `"createdAt:desc,name:asc"` ⇄ a
  `{ field, dir }[]` sort model.
- `describeFieldFilter` / `describeColumnFilter` — human chip labels. The `date`
  preset's label is supplied by an injected `describeDate` (see below); without
  it a date preset falls back to its operator label.
- `ResourceMetadata` / `FieldMetadata` — a serializable wire contract a backend
  can expose (e.g. at `…/_metadata`) and a frontend can render from.

## The Drizzle builder (`@xtandard/lib/filters/drizzle`)

Compile a request into a Drizzle `SQL` `WHERE`, allow-listed by a per-resource
**spec**. The spec maps each public field name to its column + kind; anything
not in the spec is dropped (never trust client-supplied column access). The
`dateField`/`textField`/`numberField`/… builders constrain the column by its
SELECT type, so a kind↔column mismatch is a **compile error**.

```ts
import {
  buildWhere,
  dateField,
  numberField,
  textField,
  enumField,
} from "@xtandard/lib/filters/drizzle";

const spec = {
  name: textField({ column: tasks.name }),
  status: enumField({ column: tasks.status }),
  amount: numberField({ column: tasks.amount }),
  createdAt: dateField({ column: tasks.createdAt }),
};

const { where } = buildWhere({ spec, filters, resolveDate });
db.select().from(tasks).where(where);
```

`buildFilterNode({ spec, node, resolveDate })` does the same for the recursive
and/or/not tree.

### The `date` kind is injected

The `date` preset is a DST-aware period (e.g. "this month in America/Los_Angeles")
that resolves to a half-open `[gte, lt)` instant window. That resolution — and
the human label — are **app-specific**, so the builder takes them as injected
functions instead of bundling a date library:

```ts
type DateFilterResolver = (input: { value: DatePreset }) => {
  start: Date | null;
  end: Date | null;
};
```

Pass `resolveDate` to `buildWhere`/`buildFilterNode` (a `date` preset filter
without it throws). For the chip label, pass `describeDate` to
`describeFieldFilter`. demi.casa wires its `@demi.casa/time` `resolveDateFilter`
/ `describeDateSelectorValue`; any equivalent that returns `Date` bounds works.

The temporal valibot schemas the model needs (`PlainDateTimeSchema`) and
`isValidTimeZone` live in [`@xtandard/lib/valibot`](#) (peers `valibot` +
`@js-temporal/polyfill`).

### Sorting & cursor pagination

- `buildOrderBy({ sort, columns, defaultSort })` → Drizzle `orderBy` SQL,
  allow-listed to `columns`. Use with `db.select(...).orderBy(...)` (NOT the RQB
  query — RQB aliases the root table and breaks column-referencing SQL).
- `createDrizzleKeyset({ sort, columns })` → a keyset/cursor helper
  (`keys()`/`orderBy()`/`where()`) rendered from the portable
  `@xtandard/lib/pagination` `createKeysetSpec`; `combineWhere(...)` ANDs the
  filter `WHERE` with the keyset seek. (We render the portable AST to SQL here
  rather than using `@xtandard/lib/pagination/drizzle`, whose `^0.45`
  `drizzle-orm` peer can collide with a `1.0.0-beta` install.)

## Pagination re-exports

`@xtandard/lib/filters` re-exports the frontend-safe pagination helpers
(`parsePaginationParams`, `fromRelayArgs`, `toRelayConnection`, `toRestEnvelope`,
`infinitePaginationOptions`) from `@xtandard/lib/pagination` so the filter
surface is one import. Full pagination guide: [docs/PAGINATION.md](./PAGINATION.md).
