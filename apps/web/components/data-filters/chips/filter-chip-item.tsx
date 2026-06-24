"use client";

import type {
  ExperimentDataColumn,
  ExperimentDataFilter,
} from "@repo/api/domains/experiment/experiment.schema";

import { FilterChipFace } from "./chip-face";
import { FilterRow } from "./filter-row";

export interface FilterChipItemProps {
  filter: ExperimentDataFilter;
  column: ExperimentDataColumn | undefined;
  columns: ExperimentDataColumn[];
  expanded: boolean;
  experimentId: string;
  tableName: string;
  onChange: (next: ExperimentDataFilter) => void;
  onSelect: () => void;
  onRemove: () => void;
}

export function FilterChipItem({
  filter,
  column,
  columns,
  expanded,
  experimentId,
  tableName,
  onChange,
  onSelect,
  onRemove,
}: FilterChipItemProps) {
  if (expanded) {
    return (
      <FilterRow
        filter={filter}
        columns={columns}
        experimentId={experimentId}
        tableName={tableName}
        onChange={onChange}
        onRemove={onRemove}
      />
    );
  }
  return (
    <FilterChipFace
      filter={filter}
      column={column}
      experimentId={experimentId}
      tableName={tableName}
      fullWidth
      onClick={onSelect}
      onRemove={onRemove}
    />
  );
}
