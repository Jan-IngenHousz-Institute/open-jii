"use client";

import { CheckIcon } from "@radix-ui/react-icons";
import type * as React from "react";

import { Command, CommandGroup, CommandItem, CommandList } from "../command";
import type { ListFilter } from "../list-filter-menu";

interface ValueListProps {
  filter: ListFilter;
  commandRef: React.Ref<HTMLDivElement>;
  /** Called on ArrowLeft, which leaves the list for the one it opened from. */
  onLeave?: () => void;
}

/** A filter's values as a checkbox list. */
export function ValueList({ filter, commandRef, onLeave }: ValueListProps) {
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
    <Command
      ref={commandRef}
      tabIndex={-1}
      label={filter.label}
      className="outline-hidden"
      onKeyDown={(event) => {
        if (onLeave && event.key === "ArrowLeft") {
          event.preventDefault();
          onLeave();
        }
      }}
    >
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
  );
}
