"use client";

import { useEffect, useState } from "react";

import type {
  ExperimentDataColumn,
  ExperimentDataFilter,
  ExperimentDataFilterOperator,
} from "@repo/api/domains/experiment/experiment.schema";
import { zExperimentDataFilter } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverAnchor, PopoverContent } from "@repo/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { parentColumnName } from "../filter-column-path";
import {
  defaultValueForOperator,
  operatorValueShape,
  operatorsForColumn,
} from "../filter-operators";
import { FilterValueInput } from "../value-input";
import { FilterChipFace } from "./chip-face";

interface FilterChipProps {
  filter: ExperimentDataFilter;
  column: ExperimentDataColumn | undefined;
  experimentId: string;
  tableName: string;
  onChange: (next: ExperimentDataFilter) => void;
  onRemove: () => void;
}

export function FilterChip({
  filter,
  column,
  experimentId,
  tableName,
  onChange,
  onRemove,
}: FilterChipProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ExperimentDataFilter>(filter);

  // Sync only when closed so URL back/forward doesn't clobber in-flight edits.
  useEffect(() => {
    if (!open) {
      setDraft(filter);
    }
  }, [filter, open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      if (zExperimentDataFilter.safeParse(draft).success) {
        if (!filtersEqual(draft, filter)) {
          onChange(draft);
        }
      } else {
        setDraft(filter);
      }
    }
  };

  const handleOperatorChange = (op: string) => {
    const next = op as ExperimentDataFilterOperator;
    setDraft({
      ...draft,
      operator: next,
      value:
        operatorValueShape(next) === operatorValueShape(draft.operator)
          ? draft.value
          : defaultValueForOperator(next),
    });
  };

  const handleRemoveAndClose = () => {
    onRemove();
    setOpen(false);
  };

  const operators = operatorsForColumn(column);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <FilterChipFace
          filter={filter}
          column={column}
          experimentId={experimentId}
          tableName={tableName}
          onClick={() => setOpen(true)}
          onRemove={onRemove}
        />
      </PopoverAnchor>
      <PopoverContent className="w-80 space-y-3 p-3" align="start">
        <div className="text-muted-foreground text-xs">{parentColumnName(filter.column)}</div>
        <Select value={draft.operator} onValueChange={handleOperatorChange}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterValueInput
          column={column}
          operator={draft.operator}
          value={draft.value}
          onChange={(v) => setDraft({ ...draft, value: v })}
          experimentId={experimentId}
          tableName={tableName}
        />
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleRemoveAndClose}
          >
            {t("dataFilters.remove")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!zExperimentDataFilter.safeParse(draft).success}
            onClick={() => handleOpenChange(false)}
          >
            {t("dataFilters.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function filtersEqual(a: ExperimentDataFilter, b: ExperimentDataFilter): boolean {
  if (a.column !== b.column || a.operator !== b.operator) {
    return false;
  }
  return filterValuesEqual(a.value, b.value);
}

function filterValuesEqual(a: ExperimentDataFilter["value"], b: ExperimentDataFilter["value"]): boolean {
  const bothArrays = Array.isArray(a) && Array.isArray(b);
  if (bothArrays) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
}
