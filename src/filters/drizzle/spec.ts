import type { AnyColumn } from "drizzle-orm";

/**
 * The per-resource filter ALLOW-LIST. Clients send public field names; the spec
 * maps each allowed field to its Drizzle column + data kind. Anything not in the
 * spec is dropped (never trust client-supplied column access).
 *
 * `ColumnOf<TData>` constrains a column by its SELECT data type, so the field
 * constructors (`dateField`/`textField`/…) make a kind↔column-type MISMATCH a
 * COMPILE error at spec construction — the where-builder then needs no casts.
 */

export type ColumnOf<TData> = AnyColumn<{ data: TData }>;

export type FieldSpec =
  | { kind: "date"; column: ColumnOf<Date> } // timestamptz, mode:"date" → Date
  | { kind: "text"; column: ColumnOf<string> }
  | { kind: "number"; column: ColumnOf<number> }
  | { kind: "enum"; column: ColumnOf<string> } // text-with-enum column
  | { kind: "boolean"; column: ColumnOf<boolean> }
  | { kind: "array"; column: AnyColumn }; // pg array column — element type varies

export type FilterSpec = Record<string, FieldSpec>;

export const dateField = (input: { column: ColumnOf<Date> }): FieldSpec => ({
  kind: "date",
  column: input.column,
});

export const textField = (input: { column: ColumnOf<string> }): FieldSpec => ({
  kind: "text",
  column: input.column,
});

export const numberField = (input: { column: ColumnOf<number> }): FieldSpec => ({
  kind: "number",
  column: input.column,
});

export const enumField = (input: { column: ColumnOf<string> }): FieldSpec => ({
  kind: "enum",
  column: input.column,
});

export const booleanField = (input: { column: ColumnOf<boolean> }): FieldSpec => ({
  kind: "boolean",
  column: input.column,
});

export const arrayField = (input: { column: AnyColumn }): FieldSpec => ({
  kind: "array",
  column: input.column,
});
