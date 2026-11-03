"use client";

import { ListFilter as FilterIcon } from "lucide-react";
import type * as React from "react";

import { Badge } from "./badge";
import { Button } from "./button";
import { FilterPickerContent } from "./list-filter/filter-picker-content";
import { Popover, PopoverTrigger } from "./popover";

export interface ListFilterOption<T extends string> {
  value: T;
  label: string;
}

export interface ListFilter<T extends string = string> {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: readonly ListFilterOption<T>[];
  selected: readonly T[];
  /** Called with the picked values in option order. */
  onChange(values: T[]): void;
}

export interface ListFilterLabels {
  filter: string;
  addFilter: string;
  /** Joins a chip's filter and value, as in "Status is Draft". */
  is: string;
  /** A chip's accessible name, as in "Status is Draft", in the language's own word order. */
  chip: (filter: string, value: string) => string;
  /** The row that returns from a filter's values to the list of filters on a phone. */
  back: string;
  clearFilters: string;
  selectedCount: (count: number) => string;
  removeValue: (filter: string, value: string) => string;
}

interface ListFilterMenuProps {
  filters: readonly ListFilter[];
  labels: ListFilterLabels;
}

/** One toolbar button whose menu lists every filter and opens each one's values beside it. */
export function ListFilterMenu({ filters, labels }: ListFilterMenuProps) {
  const count = filters.reduce((total, filter) => total + filter.selected.length, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <FilterIcon aria-hidden="true" />
          {labels.filter}
          {count > 0 && (
            <>
              {/* Tabular digits and a minimum width keep the button from resizing as the count changes. */}
              <Badge
                variant="secondary"
                className="min-w-5 rounded-sm px-1.5 font-normal tabular-nums"
                aria-hidden
              >
                {count}
              </Badge>
              <span className="sr-only">{labels.selectedCount(count)}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <FilterPickerContent filters={filters} labels={labels} />
    </Popover>
  );
}
