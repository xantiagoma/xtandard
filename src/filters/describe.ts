import type { ColumnFilter, DatePreset, FieldFilter } from "./types.ts";

/**
 * Frontend-safe human labels for active filters (chips, summaries). No drizzle,
 * no temporal/date dependency: the `date` kind's preset label is supplied by an
 * injected `describeDate` (the resolution of a DST-aware period preset to text
 * is app-specific — e.g. demi.casa wires its `@demi.casa/time`
 * `describeDateSelectorValue`). Without it, a date preset falls back to its
 * operator label.
 */

const OPERATOR_LABELS: Record<string, string> = {
  eq: "=",
  ne: "≠",
  lt: "<",
  gt: ">",
  lte: "≤",
  gte: "≥",
  contains: "contains",
  startsWith: "starts with",
  endsWith: "ends with",
  like: "like",
  ilike: "like",
  notIlike: "not like",
  inArray: "in",
  notInArray: "not in",
  between: "between",
  notBetween: "not between",
  isNull: "is empty",
  isNotNull: "is set",
  arrayContains: "contains all",
  arrayContained: "within",
  arrayOverlaps: "overlaps",
};

function label(operator: string): string {
  return OPERATOR_LABELS[operator] ?? operator;
}

function renderValue(value: string | number | boolean): string {
  return typeof value === "string" ? `"${value}"` : String(value);
}

/** Render a `date`-preset filter to text. Supply via {@link describeFieldFilter}. */
export type DescribeDate = (filter: DatePreset, locale?: string) => string;

/** A short, human description of a single field filter (no field name). */
export function describeFieldFilter(input: {
  filter: FieldFilter;
  locale?: string;
  describeDate?: DescribeDate;
}): string {
  const f = input.filter;

  if (f.kind === "date") {
    if ("anchor" in f) {
      return input.describeDate ? input.describeDate(f, input.locale) : label(f.operator);
    }

    return label(f.operator);
  }

  if ("from" in f) return `${label(f.operator)} ${f.from} – ${f.to}`;
  if ("values" in f) return `${label(f.operator)} ${f.values.join(", ")}`;
  if ("value" in f) return `${label(f.operator)} ${renderValue(f.value)}`;

  return label(f.operator);
}

/** `<field> <description>`, e.g. `createdAt is between Jun 1 and Jun 30`. */
export function describeColumnFilter(input: {
  columnFilter: ColumnFilter;
  label?: string;
  locale?: string;
  describeDate?: DescribeDate;
}): string {
  const name = input.label ?? input.columnFilter.field;
  const desc = describeFieldFilter({
    filter: input.columnFilter.filter,
    locale: input.locale,
    describeDate: input.describeDate,
  });

  return `${name} ${desc}`;
}
