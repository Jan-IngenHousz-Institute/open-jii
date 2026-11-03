"use client";

import { Plus } from "lucide-react";

import { Button } from "./button";
import type { ListFilter, ListFilterLabels } from "./list-filter-menu";
import { FilterPickerContent } from "./list-filter/filter-picker-content";
import { ValueChip } from "./list-filter/value-chip";
import { Popover, PopoverTrigger } from "./popover";

interface ListFilterChipsProps {
  filters: readonly ListFilter[];
  labels: ListFilterLabels;
  onClear: () => void;
}

/** One chip per picked value, a button back to any filter not yet used, and "Clear filters". */
export function ListFilterChips({ filters, labels, onClear }: ListFilterChipsProps) {
  const chips = filters.flatMap((filter) =>
    filter.options
      .filter((option) => filter.selected.includes(option.value))
      .map((option) => ({ filter, option })),
  );

  if (chips.length === 0) {
    return null;
  }

  // Once every filter has a chip, each one's values open from its chips.
  const hasUnusedFilter = filters.some((filter) => filter.selected.length === 0);

  return (
    <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-md border p-2">
      {chips.map(({ filter, option }) => (
        <ValueChip
          key={`${filter.key}:${option.value}`}
          filter={filter}
          option={option}
          labels={labels}
        />
      ))}
      {hasUnusedFilter && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-7" aria-label={labels.addFilter}>
              <Plus aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <FilterPickerContent filters={filters} labels={labels} />
        </Popover>
      )}
      <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={onClear}>
        {labels.clearFilters}
      </Button>
    </div>
  );
}
