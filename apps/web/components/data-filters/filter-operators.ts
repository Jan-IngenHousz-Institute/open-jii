import type {
  ExperimentDataFilter,
  ExperimentDataFilterOperator,
  ExperimentDataFilterValue,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import { zExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";
import type { ColumnKind } from "@repo/api/transforms/column-type-utils";

export interface OperatorChoice {
  value: ExperimentDataFilterOperator;
  label: string;
}

export type OperatorValueShape = "scalar" | "tuple" | "array";

const NUMERIC_OPERATORS: OperatorChoice[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "greater_than_or_equal", label: "≥" },
  { value: "less_than_or_equal", label: "≤" },
  { value: "between", label: "between" },
  { value: "in", label: "in" },
];

const TEMPORAL_OPERATORS: OperatorChoice[] = [
  { value: "equals", label: "is on" },
  { value: "not_equals", label: "is not" },
  { value: "greater_than", label: "after" },
  { value: "less_than", label: "before" },
  { value: "greater_than_or_equal", label: "on or after" },
  { value: "less_than_or_equal", label: "on or before" },
  { value: "between", label: "between" },
  { value: "in", label: "in" },
];

const CATEGORICAL_OPERATORS: OperatorChoice[] = [
  { value: "equals", label: "is" },
  { value: "not_equals", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "in", label: "in" },
];

const UNKNOWN_OPERATORS: OperatorChoice[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "greater_than_or_equal", label: "≥" },
  { value: "less_than_or_equal", label: "≤" },
  { value: "between", label: "between" },
  { value: "contains", label: "contains" },
  { value: "in", label: "in" },
];

export const ALL_OPERATORS = UNKNOWN_OPERATORS;

export function operatorsForKind(kind: ColumnKind | undefined): OperatorChoice[] {
  if (kind === "numeric") {
    return NUMERIC_OPERATORS;
  }
  if (kind === "temporal") {
    return TEMPORAL_OPERATORS;
  }
  if (kind === "categorical") {
    return CATEGORICAL_OPERATORS;
  }
  return UNKNOWN_OPERATORS;
}

export function operatorsForColumn(column: ExperimentDataColumn | undefined): OperatorChoice[] {
  return operatorsForKind(column ? getColumnKind(column.type_text) : undefined);
}

export function coerceOperatorForColumn(
  operator: ExperimentDataFilterOperator,
  column: ExperimentDataColumn | undefined,
): ExperimentDataFilterOperator {
  const allowed = operatorsForColumn(column).map((o) => o.value);
  return allowed.includes(operator) ? operator : "equals";
}

export function operatorValueShape(op: ExperimentDataFilterOperator): OperatorValueShape {
  if (op === "between") {
    return "tuple";
  }
  if (op === "in") {
    return "array";
  }
  return "scalar";
}

export function defaultValueForOperator(
  op: ExperimentDataFilterOperator,
): ExperimentDataFilterValue {
  if (op === "between" || op === "in") {
    return [];
  }
  return "";
}

/** Best-fit operator for a column based on its column kind. */
export function defaultOperatorForColumn(
  column: ExperimentDataColumn | undefined,
): ExperimentDataFilterOperator {
  const kind = column ? getColumnKind(column.type_text) : undefined;
  if (kind === "temporal") {
    return "between";
  }
  if (kind === "categorical") {
    return "in";
  }
  return "equals";
}

export type FilterIssue =
  | "rangeMissingEnd"
  | "rangeMissingStart"
  | "rangeReversed"
  | "invalidValue";

export type FilterClassification =
  | { status: "unset" }
  | { status: "applied"; filter: ExperimentDataFilter }
  | { status: "invalid"; reason: FilterIssue };

interface FilterDraft {
  column: string;
  operator: ExperimentDataFilterOperator;
  value: ExperimentDataFilterValue | undefined;
}

/**
 * Whether a filter as the user left it applies, is still empty, or is invalid and why, so a caller
 * can say why a filter was skipped. The schema decides validity, except that a range must also run
 * from low to high: the schema can't require that without rejecting already-saved reversed ranges.
 */
export function classifyFilter({ column, operator, value }: FilterDraft): FilterClassification {
  if (value === undefined || isEmptyValue(value)) {
    return { status: "unset" };
  }
  if (operator === "between" && Array.isArray(value)) {
    const [start, end] = value;
    const hasStart = !isEmptyBound(start);
    const hasEnd = !isEmptyBound(end);
    if (!hasStart && !hasEnd) {
      return { status: "unset" };
    }
    if (!hasEnd) {
      return { status: "invalid", reason: "rangeMissingEnd" };
    }
    if (!hasStart) {
      return { status: "invalid", reason: "rangeMissingStart" };
    }
  }

  const filter: ExperimentDataFilter = { column, operator, value };
  if (!zExperimentDataFilter.safeParse(filter).success) {
    return { status: "invalid", reason: "invalidValue" };
  }
  if (operator === "between" && Array.isArray(value) && isReversedRange(value[0], value[1])) {
    return { status: "invalid", reason: "rangeReversed" };
  }
  return { status: "applied", filter };
}

function isEmptyValue(value: ExperimentDataFilterValue): boolean {
  return value === "" || (Array.isArray(value) && value.length === 0);
}

function isEmptyBound(bound: unknown): boolean {
  return bound === undefined || bound === null || bound === "";
}

function isReversedRange(start: unknown, end: unknown): boolean {
  if (typeof start === "number" && typeof end === "number") {
    return start > end;
  }
  if (typeof start === "string" && typeof end === "string") {
    const startTime = Date.parse(start);
    const endTime = Date.parse(end);
    return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime > endTime;
  }
  return false;
}
