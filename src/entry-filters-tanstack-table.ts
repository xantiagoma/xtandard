/**
 * TanStack Table bridge: convert a table's `columnFilters`, `globalFilter`, `sorting` and `pagination` state to and from the filter model (`ColumnFilter[]` / `FilterNode`), `Sort`, page/offset pagination and cursors, through a per-column mapping spec. For server-side (`manual*`) tables synced to the URL. Zero dependencies; works with `@tanstack/table-core` v8 and v9.
 *
 * Import from `@xtandard/lib/filters/tanstack-table`. The typings need TypeScript 5.4+ (they use `NoInfer`).
 *
 * @module filters/tanstack-table
 */

export * from "./filters/tanstack-table.ts";
