"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { useIsMobile } from "../../hooks/use-mobile";
import { Command, CommandGroup, CommandItem, CommandList } from "../command";
import type { ListFilter, ListFilterLabels } from "../list-filter-menu";
import { Popover, PopoverAnchor, PopoverContent } from "../popover";
import { focusCommandRoot } from "./focus-command-root";
import { ValueList } from "./value-list";
import { ValueListContent } from "./value-list-content";

interface FilterPickerContentProps {
  filters: readonly ListFilter[];
  labels: ListFilterLabels;
}

/**
 * The list of filters in a popover. Each opens its values beside it, or on a phone, where there is
 * no room beside it, in its place with a back row.
 */
export function FilterPickerContent({ filters, labels }: FilterPickerContentProps) {
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [highlighted, setHighlighted] = React.useState("");
  const commandRef = React.useRef<HTMLDivElement>(null);
  const valuesRef = React.useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const active = filters.find((filter) => filter.key === activeKey);

  // On a phone the two lists swap in place, so focus follows the swap.
  React.useEffect(() => {
    if (!isMobile) return;
    (activeKey ? valuesRef : commandRef).current?.focus({ preventScroll: true });
  }, [activeKey, isMobile]);

  const back = () => setActiveKey(null);

  if (isMobile && active) {
    return (
      <PopoverContent
        className="w-[220px] p-0"
        align="start"
        onOpenAutoFocus={focusCommandRoot(valuesRef)}
      >
        <button
          type="button"
          onClick={back}
          className="hover:bg-accent flex w-full items-center gap-2 border-b px-2 py-1.5 text-sm"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {labels.back}
        </button>
        <ValueList filter={active} commandRef={valuesRef} onLeave={back} />
      </PopoverContent>
    );
  }

  return (
    <PopoverContent
      className="w-[220px] p-0"
      align="start"
      onOpenAutoFocus={focusCommandRoot(commandRef)}
    >
      <Command
        ref={commandRef}
        tabIndex={-1}
        label={labels.filter}
        className="outline-hidden"
        value={highlighted}
        onValueChange={setHighlighted}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight") return;
          const filter = filters.find(
            (candidate) => candidate.label.toLowerCase() === highlighted.toLowerCase(),
          );
          if (!filter) return;
          event.preventDefault();
          setActiveKey(filter.key);
        }}
      >
        <CommandList label={labels.filter}>
          <CommandGroup>
            {filters.map((filter) => {
              const Icon = filter.icon;
              const row = (
                <CommandItem
                  key={filter.key}
                  value={filter.label}
                  aria-haspopup="listbox"
                  onSelect={() => setActiveKey(filter.key)}
                >
                  <Icon aria-hidden="true" />
                  {filter.label}
                  <ChevronRight aria-hidden="true" className="ml-auto" />
                </CommandItem>
              );
              if (isMobile) return row;

              const isActive = activeKey === filter.key;
              return (
                <Popover
                  key={filter.key}
                  open={isActive}
                  onOpenChange={(open) => setActiveKey(open ? filter.key : null)}
                >
                  <PopoverAnchor asChild>{row}</PopoverAnchor>
                  {/* Mounted only while open: a closing value list stays the top layer
                      through its fade-out and swallows the Escape meant for this menu. */}
                  {isActive && (
                    <ValueListContent
                      filter={filter}
                      side="right"
                      align="start"
                      onLeave={back}
                      // No trigger to return to, so focus goes back to the filter list.
                      onCloseAutoFocus={focusCommandRoot(commandRef)}
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
