"use client";

import { ArrowLeft } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import type {
  ExperimentDataFilter,
  ExperimentDataFilterOperator,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import {
  defaultValueForOperator,
  operatorValueShape,
  operatorsForColumn,
} from "../filter-operators";
import { FilterValueInput } from "../value-input";

export interface AddFilterDraftEditorProps {
  column: ExperimentDataColumn;
  experimentId: string;
  tableName: string;
  onBack: () => void;
  onCancel: () => void;
  onApply: () => void;
}

export function AddFilterDraftEditor({
  column,
  experimentId,
  tableName,
  onBack,
  onCancel,
  onApply,
}: AddFilterDraftEditorProps) {
  const { t } = useTranslation("common");
  const form = useFormContext<ExperimentDataFilter>();
  const operator = useWatch({ control: form.control, name: "operator" });
  const value = useWatch({ control: form.control, name: "value" });
  const canApply = form.formState.isValid;

  const handleOperatorChange = (op: string) => {
    const next = op as ExperimentDataFilterOperator;
    const shapeMatches = operatorValueShape(next) === operatorValueShape(operator);
    form.setValue("operator", next, { shouldValidate: true });
    if (!shapeMatches) {
      form.setValue("value", defaultValueForOperator(next), { shouldValidate: true });
    }
  };

  return (
    <div className="space-y-3 p-3">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        onClick={onBack}
      >
        <ArrowLeft className="h-3 w-3" />
        {column.name}
      </button>
      <Select value={operator} onValueChange={handleOperatorChange}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operatorsForColumn(column).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FilterValueInput
        column={column}
        operator={operator}
        value={value}
        onChange={(v) => form.setValue("value", v, { shouldValidate: true })}
        experimentId={experimentId}
        tableName={tableName}
      />
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t("dataFilters.cancel")}
        </Button>
        <Button type="button" size="sm" disabled={!canApply} onClick={onApply}>
          {t("dataFilters.apply")}
        </Button>
      </div>
    </div>
  );
}
