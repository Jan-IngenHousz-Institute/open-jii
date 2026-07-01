"use client";

import { useMemo } from "react";

import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { AddFilterPopover } from "./add-filter/add-filter-popover";
import { FilterChip } from "./chips/filter-chip";
import { parentColumnName } from "./filter-column-path";
import { useStableFilterKeys } from "./use-stable-filter-keys";

interface FilterChipBarProps {
  value: ExperimentDataFilter[];
  onChange: (next: ExperimentDataFilter[]) => void;
  columns: ExperimentDataColumn[];
  experimentId: string;
  tableName: string;
}

export function FilterChipBar({
  value,
  onChange,
  columns,
  experimentId,
  tableName,
}: FilterChipBarProps) {
  const handleChipChange = (index: number, next: ExperimentDataFilter) => {
    const out = [...value];
    out[index] = next;
    onChange(out);
  };

  const handleChipRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleAdd = (filter: ExperimentDataFilter) => {
    onChange([...value, filter]);
  };

  // Index keys would shift chip-local popover state on neighbour add/remove.
  const keys = useStableFilterKeys(value);
  const columnByName = useMemo(() => new Map(columns.map((c) => [c.name, c])), [columns]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((filter, i) => {
        const col = columnByName.get(parentColumnName(filter.column));
        return (
          <FilterChip
            key={keys[i] ?? i}
            filter={filter}
            column={col}
            experimentId={experimentId}
            tableName={tableName}
            onChange={(next) => handleChipChange(i, next)}
            onRemove={() => handleChipRemove(i)}
          />
        );
      })}
      <AddFilterPopover
        columns={columns}
        experimentId={experimentId}
        tableName={tableName}
        onAdd={handleAdd}
      />
    </div>
  );
}
