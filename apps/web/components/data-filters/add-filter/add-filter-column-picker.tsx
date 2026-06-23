"use client";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";
import type { ColumnKind } from "@repo/api/transforms/column-type-utils";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";

const KIND_LABEL_KEYS: Record<ColumnKind, string> = {
  temporal: "dataFilters.kindTemporal",
  numeric: "dataFilters.kindNumeric",
  categorical: "dataFilters.kindCategorical",
  complex: "dataFilters.kindComplex",
};

const KIND_ORDER: ColumnKind[] = ["temporal", "numeric", "categorical", "complex"];

export interface AddFilterColumnPickerProps {
  columns: ExperimentDataColumn[];
  onPick: (column: ExperimentDataColumn) => void;
}

export function AddFilterColumnPicker({ columns, onPick }: AddFilterColumnPickerProps) {
  const { t } = useTranslation("common");
  const grouped = groupColumnsByKind(columns);

  return (
    <Command>
      <CommandInput placeholder={t("dataFilters.filterByColumnPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("dataFilters.noColumnsToFilter")}</CommandEmpty>
        {KIND_ORDER.map((kind) => {
          const cols = grouped[kind] ?? [];
          if (cols.length === 0) {
            return null;
          }
          return (
            <CommandGroup key={kind} heading={t(KIND_LABEL_KEYS[kind])}>
              {cols.map((col) => (
                <FilterColumnOption key={col.name} column={col} onPick={onPick} />
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </Command>
  );
}

interface FilterColumnOptionProps {
  column: ExperimentDataColumn;
  onPick: (column: ExperimentDataColumn) => void;
}

function FilterColumnOption({ column, onPick }: FilterColumnOptionProps) {
  return (
    <CommandItem value={column.name} onSelect={() => onPick(column)}>
      <span className="min-w-0 flex-1 truncate">{column.name}</span>
      <span className="text-muted-foreground/70 ml-2 shrink-0 font-mono text-[10px] uppercase">
        {column.type_name}
      </span>
    </CommandItem>
  );
}

function groupColumnsByKind(columns: ExperimentDataColumn[]): Partial<Record<ColumnKind, ExperimentDataColumn[]>> {
  const groups: Partial<Record<ColumnKind, ExperimentDataColumn[]>> = {};
  for (const col of columns) {
    const kind = getColumnKind(col.type_text) ?? "complex";
    groups[kind] ??= [];
    groups[kind].push(col);
  }
  return groups;
}
