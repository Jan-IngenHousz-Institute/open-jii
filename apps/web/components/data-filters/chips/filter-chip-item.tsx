"use client";

import type { DataColumn, DataFilter } from "@repo/api/schemas/experiment.schema";

import { FilterChipFace } from "./chip-face";
import { FilterRow } from "./filter-row";

export interface FilterChipItemProps {
  filter: DataFilter;
  column: DataColumn | undefined;
  columns: DataColumn[];
  expanded: boolean;
  experimentId: string;
  tableName: string;
  onChange: (next: DataFilter) => void;
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
