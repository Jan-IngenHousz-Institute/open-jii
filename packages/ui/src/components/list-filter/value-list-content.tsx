"use client";

import { CheckIcon } from "@radix-ui/react-icons";
import * as React from "react";

import { Command, CommandGroup, CommandItem, CommandList } from "../command";
import type { ListFilter } from "../list-filter-menu";
import { PopoverContent } from "../popover";

interface ValueListContentProps extends React.ComponentPropsWithoutRef<typeof PopoverContent> {
  filter: ListFilter;
}

/** A filter's values as a checkbox list in a popover. */
export function ValueListContent({ filter, ...props }: ValueListContentProps) {
  const commandRef = React.useRef<HTMLDivElement>(null);
  const picked = new Set(filter.selected);

  const toggle = (value: string) => {
    const next = new Set(picked);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    filter.onChange(filter.options.map((option) => option.value).filter((v) => next.has(v)));
  };

  return (
    <PopoverContent
      className="w-[220px] p-0"
      {...props}
      // Nothing inside is tabbable, and cmdk reads the arrow keys on its root.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        commandRef.current?.focus({ preventScroll: true });
      }}
    >
      <Command ref={commandRef} tabIndex={-1} label={filter.label} className="outline-hidden">
        <CommandList label={filter.label}>
          <CommandGroup>
            {filter.options.map((option) => {
              const isPicked = picked.has(option.value);
              return (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  aria-checked={isPicked}
                  onSelect={() => toggle(option.value)}
                >
                  <span
                    aria-hidden="true"
                    data-state={isPicked ? "checked" : "unchecked"}
                    className="border-input data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground grid size-4 shrink-0 place-content-center rounded-[4px] border"
                  >
                    {isPicked && <CheckIcon className="size-3.5" />}
                  </span>
                  {option.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}
