"use client";

import { useMemo, useRef, useState } from "react";

import type { DataColumn, DataFilter } from "@repo/api/schemas/experiment.schema";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";

import { AddFilterPopover } from "../add-filter/add-filter-popover";
import { parentColumnName } from "../filter-column-path";
import { FilterChipItem } from "./filter-chip-item";

interface FilterChipListProps {
  value: DataFilter[];
  onChange: (next: DataFilter[]) => void;
  columns: DataColumn[];
  experimentId: string;
  tableName: string;
}

export function FilterChipList({
  value,
  onChange,
  columns,
  experimentId,
  tableName,
}: FilterChipListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setExpandedIndex(null), {
    enabled: expandedIndex !== null,
  });

  const handleChipChange = (index: number, next: DataFilter) => {
    const out = [...value];
    out[index] = next;
    onChange(out);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    // Shift expanded index so it tracks the same row after removal.
    setExpandedIndex((current) => {
      if (current === null) {
        return null;
      }
      if (current === index) {
        return null;
      }
      if (current > index) {
        return current - 1;
      }
      return current;
    });
  };

  const handleAdd = (filter: DataFilter) => {
    onChange([...value, filter]);
  };

  const columnByName = useMemo(() => new Map(columns.map((c) => [c.name, c])), [columns]);

  return (
    <div ref={containerRef} className="space-y-2">
      {value.map((filter, index) => (
        <FilterChipItem
          key={index}
          filter={filter}
          column={columnByName.get(parentColumnName(filter.column))}
          columns={columns}
          expanded={expandedIndex === index}
          experimentId={experimentId}
          tableName={tableName}
          onChange={(next) => handleChipChange(index, next)}
          onSelect={() => setExpandedIndex(index)}
          onRemove={() => handleRemove(index)}
        />
      ))}
      <div>
        <AddFilterPopover
          columns={columns}
          experimentId={experimentId}
          tableName={tableName}
          onAdd={handleAdd}
        />
      </div>
    </div>
  );
}
