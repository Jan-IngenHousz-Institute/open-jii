import type {
  ExperimentDataFilterOperator,
  ExperimentDataFilterValue,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";
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
