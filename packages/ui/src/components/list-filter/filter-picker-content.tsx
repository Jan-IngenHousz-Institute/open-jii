"use client";

import { ChevronRight } from "lucide-react";
import * as React from "react";

import { Command, CommandGroup, CommandItem, CommandList } from "../command";
import type { ListFilter, ListFilterLabels } from "../list-filter-menu";
import { Popover, PopoverAnchor, PopoverContent } from "../popover";
import { ValueListContent } from "./value-list-content";

interface FilterPickerContentProps {
  filters: readonly ListFilter[];
  labels: ListFilterLabels;
}

/** The list of filters in a popover, each opening its values beside it. */
export function FilterPickerContent({ filters, labels }: FilterPickerContentProps) {
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const commandRef = React.useRef<HTMLDivElement>(null);

  return (
    <PopoverContent
      className="w-[220px] p-0"
      align="start"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        commandRef.current?.focus({ preventScroll: true });
      }}
    >
      <Command ref={commandRef} tabIndex={-1} label={labels.filter} className="outline-hidden">
        <CommandList label={labels.filter}>
          <CommandGroup>
            {filters.map((filter) => {
              const Icon = filter.icon;
              const isActive = activeKey === filter.key;
              return (
                <Popover
                  key={filter.key}
                  open={isActive}
                  onOpenChange={(open) => setActiveKey(open ? filter.key : null)}
                >
                  <PopoverAnchor asChild>
                    <CommandItem
                      value={filter.label}
                      aria-haspopup="listbox"
                      aria-expanded={isActive}
                      onSelect={() => setActiveKey(filter.key)}
                    >
                      <Icon aria-hidden="true" />
                      {filter.label}
                      <ChevronRight aria-hidden="true" className="ml-auto" />
                    </CommandItem>
                  </PopoverAnchor>
                  {/* Mounted only while open: a closing value list stays the top layer
                      through its fade-out and swallows the Escape meant for this menu. */}
                  {isActive && (
                    <ValueListContent
                      filter={filter}
                      side="right"
                      align="start"
                      // No trigger to return to, so focus goes back to the filter list.
                      onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        commandRef.current?.focus({ preventScroll: true });
                      }}
                    />
                  )}
                </Popover>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}
