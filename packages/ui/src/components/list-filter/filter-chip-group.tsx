"use client";

import * as React from "react";

import type { ListFilter, ListFilterLabels } from "../list-filter-menu";
import { Popover, PopoverAnchor } from "../popover";
import { ValueChip } from "./value-chip";
import { ValueListContent } from "./value-list-content";

interface FilterChipGroupProps {
  filter: ListFilter;
  labels: ListFilterLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Takes focus when the list closes after its last chip went. */
  fallbackFocusRef: React.RefObject<HTMLElement | null>;
}

/**
 * One filter's chips and the value list they share. The list belongs to the filter, not to a
 * chip, so unticking the chip it opened from leaves it open.
 */
export function FilterChipGroup({
  filter,
  labels,
  open,
  onOpenChange,
  fallbackFocusRef,
}: FilterChipGroupProps) {
  const groupRef = React.useRef<HTMLDivElement>(null);
  const picked = filter.options.filter((option) => filter.selected.includes(option.value));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div ref={groupRef} className="flex flex-wrap items-center gap-2">
          {picked.map((option) => (
            <ValueChip
              key={option.value}
              filter={filter}
              option={option}
              labels={labels}
              expanded={open}
              onToggleValues={() => onOpenChange(!open)}
            />
          ))}
        </div>
      </PopoverAnchor>
      {open && (
        <ValueListContent
          filter={filter}
          align="start"
          // A chip's own value button toggles the list; dismissing first would reopen it.
          onInteractOutside={(event) => {
            if (event.target instanceof Node && groupRef.current?.contains(event.target)) {
              event.preventDefault();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const chip = groupRef.current?.querySelector<HTMLElement>("[aria-haspopup]");
            (chip ?? fallbackFocusRef.current)?.focus({ preventScroll: true });
          }}
        />
      )}
    </Popover>
  );
}
