"use client";

import { X } from "lucide-react";

import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { filterColumnPathFor, parentColumnName } from "../filter-column-path";
import { coerceOperatorForColumn, operatorsForColumn } from "../filter-operators";
import { FilterValueInput } from "../value-input";

interface FilterRowProps {
  filter: ExperimentDataFilter;
  columns: ExperimentDataColumn[];
  experimentId: string;
  tableName: string;
  onChange: (next: ExperimentDataFilter) => void;
  onRemove: () => void;
}

export function FilterRow({
  filter,
  columns,
  experimentId,
  tableName,
  onChange,
  onRemove,
}: FilterRowProps) {
  const { t } = useTranslation("common");
  // Strip struct sub-path; metadata is keyed by parent name.
  const pickedColumn = columns.find((c) => c.name === parentColumnName(filter.column));
  const operators = operatorsForColumn(pickedColumn);

  const handleColumnChange = (columnName: string) => {
    const nextColumn = columns.find((c) => c.name === columnName);
    const nextOperator = coerceOperatorForColumn(filter.operator, nextColumn);
    const nextPath = nextColumn ? filterColumnPathFor(nextColumn) : columnName;
    const samePicked = pickedColumn?.name === columnName;
    const nextValue = samePicked ? filter.value : "";
    onChange({ column: nextPath, operator: nextOperator, value: nextValue });
  };

  return (
    <div className="bg-muted/30 space-y-2 rounded-md border p-2.5">
      <div className="flex items-center gap-2">
        <Select value={pickedColumn?.name ?? undefined} onValueChange={handleColumnChange}>
          <SelectTrigger className="h-9 flex-1">
            <SelectValue placeholder={t("dataFilters.selectColumn")}>
              {pickedColumn?.name ?? ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {columns.map((column) => (
              <SelectItem key={column.name} value={column.name}>
                <div className="flex items-center gap-2">
                  <span className="truncate">{column.name}</span>
                  <Badge
                    variant="outline"
                    className="text-muted-foreground h-4 px-1.5 py-0 font-mono text-[10px] font-normal leading-none"
                  >
                    {column.type_name}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.operator}
          onValueChange={(op) =>
            onChange({ ...filter, operator: op as ExperimentDataFilter["operator"] })
          }
        >
          <SelectTrigger className="h-9 w-[110px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hover:bg-destructive/10 hover:text-destructive h-9 w-9 shrink-0 p-0"
          onClick={onRemove}
          aria-label={t("dataFilters.removeFilter")}
          title={t("dataFilters.removeFilter")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <FilterValueInput
        column={pickedColumn}
        operator={filter.operator}
        value={filter.value}
        onChange={(v) => onChange({ ...filter, value: v })}
        experimentId={experimentId}
        tableName={tableName}
      />
    </div>
  );
}
