"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type {
  ExperimentDataFilter,
  ExperimentDataFilterOperator,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import { zExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";
import type { ColumnKind } from "@repo/api/transforms/column-type-utils";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

import { AddFilterColumnPicker } from "../add-filter/add-filter-column-picker";
import { AddFilterDraftEditor } from "../add-filter/add-filter-draft-editor";
import { filterColumnPathFor } from "../filter-column-path";
import { defaultValueForOperator } from "../filter-operators";

const EMPTY_DRAFT: ExperimentDataFilter = { column: "", operator: "equals", value: "" };

export interface AddFilterPopoverProps {
  columns: ExperimentDataColumn[];
  experimentId: string;
  tableName: string;
  onAdd: (filter: ExperimentDataFilter) => void;
}

export function AddFilterPopover({
  columns,
  experimentId,
  tableName,
  onAdd,
}: AddFilterPopoverProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [pickedColumn, setPickedColumn] = useState<ExperimentDataColumn | undefined>(undefined);

  const form = useForm<ExperimentDataFilter>({
    resolver: zodResolver(zExperimentDataFilter),
    mode: "onChange",
    defaultValues: EMPTY_DRAFT,
  });

  const reset = () => {
    setPickedColumn(undefined);
    form.reset(EMPTY_DRAFT);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handlePick = (col: ExperimentDataColumn) => {
    const operator = defaultOperatorForKind(getColumnKind(col.type_text));
    setPickedColumn(col);
    // Struct columns route to the identity sub-field so the filter is wire-ready.
    form.reset({
      column: filterColumnPathFor(col),
      operator,
      value: defaultValueForOperator(operator),
    });
  };

  const handleApply = form.handleSubmit((data) => {
    onAdd(data);
    setOpen(false);
    reset();
  });

  const handleCancel = () => {
    reset();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1.5 border-dashed text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("dataFilters.addFilter")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {pickedColumn ? (
          <FormProvider {...form}>
            <AddFilterDraftEditor
              column={pickedColumn}
              experimentId={experimentId}
              tableName={tableName}
              onBack={reset}
              onCancel={handleCancel}
              onApply={handleApply}
            />
          </FormProvider>
        ) : (
          <AddFilterColumnPicker columns={columns} onPick={handlePick} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function defaultOperatorForKind(kind: ColumnKind | undefined): ExperimentDataFilterOperator {
  if (kind === "temporal") return "between";
  return "equals";
}
