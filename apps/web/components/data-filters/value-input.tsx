"use client";

import type {
  ExperimentDataFilterOperator,
  ExperimentDataFilterValue,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";

import { CategoricalMultiInput } from "./value-inputs/categorical-multi-input";
import { CategoricalSingleInput } from "./value-inputs/categorical-single-input";
import { CommaSeparatedInput } from "./value-inputs/comma-separated-input";
import { DateRangeInput } from "./value-inputs/date-range-input";
import { DateTimeInput } from "./value-inputs/date-time-input";
import { NumericInput } from "./value-inputs/numeric-input";
import { NumericRangeInput } from "./value-inputs/numeric-range-input";
import { TextInput } from "./value-inputs/text-input";

export interface FilterValueInputProps {
  column: ExperimentDataColumn | undefined;
  operator: ExperimentDataFilterOperator;
  value: ExperimentDataFilterValue;
  onChange: (value: ExperimentDataFilterValue) => void;
  experimentId: string;
  tableName: string;
}

export function FilterValueInput({
  column,
  operator,
  value,
  onChange,
  experimentId,
  tableName,
}: FilterValueInputProps) {
  const { t } = useTranslation("common");
  const kind = column ? getColumnKind(column.type_text) : undefined;

  if (operator === "between") {
    if (kind === "temporal") {
      return <DateRangeInput value={value} onChange={onChange} />;
    }
    return <NumericRangeInput value={value} onChange={onChange} />;
  }

  if (operator === "in") {
    if (kind === "categorical" && column) {
      return (
        <CategoricalMultiInput
          column={column}
          experimentId={experimentId}
          tableName={tableName}
          value={value}
          onChange={onChange}
        />
      );
    }
    return <CommaSeparatedInput value={value} onChange={onChange} kind={kind} />;
  }

  if (kind === "temporal") {
    return <DateTimeInput value={value} onChange={onChange} />;
  }

  if (kind === "numeric") {
    return <NumericInput value={value} onChange={onChange} />;
  }

  if (operator === "contains") {
    return (
      <TextInput
        value={value}
        onChange={onChange}
        placeholder={t("dataFilters.placeholderSubstring")}
      />
    );
  }

  if (kind === "categorical" && column) {
    return (
      <CategoricalSingleInput
        column={column}
        experimentId={experimentId}
        tableName={tableName}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <TextInput value={value} onChange={onChange} placeholder={t("dataFilters.placeholderValue")} />
  );
}
