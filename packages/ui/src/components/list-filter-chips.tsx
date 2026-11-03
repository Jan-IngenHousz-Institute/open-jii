"use client";

import { Plus } from "lucide-react";
import * as React from "react";

import { Button } from "./button";
import type { ListFilter, ListFilterLabels } from "./list-filter-menu";
import { FilterChipGroup } from "./list-filter/filter-chip-group";
import { FilterPickerContent } from "./list-filter/filter-picker-content";
import { Popover, PopoverTrigger } from "./popover";

interface ListFilterChipsProps {
  filters: readonly ListFilter[];
  labels: ListFilterLabels;
  onClear: () => void;
}

/** One chip per picked value, a button back to the list of filters, and "Clear filters". */
export function ListFilterChips({ filters, labels, onClear }: ListFilterChipsProps) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const addRef = React.useRef<HTMLButtonElement>(null);

  // A filter whose list is open stays, even once its last value is unticked, until it closes.
  const shown = filters.filter((filter) => filter.selected.length > 0 || filter.key === openKey);

  if (shown.length === 0 && !isAdding) {
    return null;
  }

  return (
    <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-md border p-2">
      {shown.map((filter) => (
        <FilterChipGroup
          key={filter.key}
          filter={filter}
          labels={labels}
          open={openKey === filter.key}
          onOpenChange={(open) => setOpenKey(open ? filter.key : null)}
          fallbackFocusRef={addRef}
        />
      ))}
      <Popover open={isAdding} onOpenChange={setIsAdding}>
        <PopoverTrigger asChild>
          <Button
            ref={addRef}
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label={labels.addFilter}
          >
            <Plus aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <FilterPickerContent filters={filters} labels={labels} />
      </Popover>
      <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={onClear}>
        {labels.clearFilters}
      </Button>
    </div>
  );
}
