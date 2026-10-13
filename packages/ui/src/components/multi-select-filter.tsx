"use client";

import { CheckIcon, PlusCircledIcon } from "@radix-ui/react-icons";
import * as React from "react";

import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Separator } from "./separator";

interface MultiSelectFilterOption<T extends string> {
  value: T;
  label: string;
}

interface MultiSelectFilterProps<T extends string> {
  title: string;
  options: readonly MultiSelectFilterOption<T>[];
  selected: readonly T[];
  /** Called with the picked values in option order. */
  onChange: (values: T[]) => void;
  /** Defaults to the title. */
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Read out after the title instead of the bare count badge. */
  selectedCountLabel?: (count: number) => string;
  className?: string;
}

/** A toolbar filter: a checkbox list in a popover whose button counts the picked values. */
export function MultiSelectFilter<T extends string>({
  title,
  options,
  selected,
  onChange,
  searchPlaceholder,
  emptyLabel,
  selectedCountLabel,
  className,
}: MultiSelectFilterProps<T>) {
  const picked = new Set(selected);

  const toggle = (value: T) => {
    const next = new Set(picked);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(options.map((option) => option.value).filter((option) => next.has(option)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 border-dashed", className)}>
          <PlusCircledIcon aria-hidden="true" />
          {title}
          {picked.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              {/* Tabular digits and a minimum width keep the button from resizing as the count changes. */}
              <Badge
                variant="secondary"
                className="min-w-5 rounded-sm px-1.5 font-normal tabular-nums"
                aria-hidden
              >
                {picked.size}
              </Badge>
              {selectedCountLabel && (
                <span className="sr-only">{selectedCountLabel(picked.size)}</span>
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? title} />
          <CommandList>
            {emptyLabel && <CommandEmpty>{emptyLabel}</CommandEmpty>}
            <CommandGroup>
              {options.map((option) => {
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
    </Popover>
  );
}
