"use client";

import { X } from "lucide-react";

import { Button } from "../button";
import type { ListFilter, ListFilterLabels, ListFilterOption } from "../list-filter-menu";
import { Popover, PopoverTrigger } from "../popover";
import { ValueListContent } from "./value-list-content";

interface ValueChipProps {
  filter: ListFilter;
  option: ListFilterOption<string>;
  labels: ListFilterLabels;
}

/** One picked value, as in "Status is Draft", whose value reopens the list and whose cross removes it. */
export function ValueChip({ filter, option, labels }: ValueChipProps) {
  const Icon = filter.icon;

  return (
    <div
      role="group"
      aria-label={`${filter.label} ${labels.is} ${option.label}`}
      className="bg-background shadow-xs inline-flex h-7 items-center rounded-md border text-xs"
    >
      <span className="flex items-center gap-1.5 px-2 font-medium">
        <Icon aria-hidden="true" className="text-muted-foreground size-3.5" />
        {filter.label}
      </span>
      <span className="text-muted-foreground border-l px-2">{labels.is}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="hover:bg-muted/50 h-full rounded-none border-l font-normal"
          >
            {option.label}
          </Button>
        </PopoverTrigger>
        <ValueListContent filter={filter} align="start" />
      </Popover>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:bg-muted/50 hover:text-destructive h-full w-6 rounded-l-none border-l"
        aria-label={labels.removeValue(filter.label, option.label)}
        onClick={() => filter.onChange(filter.selected.filter((value) => value !== option.value))}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
