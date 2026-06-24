"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

interface WorkbookOption {
  id: string;
  name: string;
}

interface WorkbookSelectProps {
  workbooks: WorkbookOption[];
  value?: string;
  onChange: (id: string | undefined) => void;
  triggerPlaceholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** When set, renders a leading entry that clears the selection (`undefined`). */
  noneLabel?: string;
  disabled?: boolean;
  triggerId?: string;
  triggerClassName?: string;
  invalid?: boolean;
}

const NONE_VALUE = "__none__";

/**
 * Searchable workbook picker. Filtering is client-side over the already-loaded
 * list; the item `value` carries the name (for cmdk's fuzzy match) plus the id
 * (so duplicate names stay distinct), while selection resolves back to the id.
 */
export function WorkbookSelect({
  workbooks,
  value,
  onChange,
  triggerPlaceholder,
  searchPlaceholder,
  emptyText,
  noneLabel,
  disabled,
  triggerId,
  triggerClassName,
  invalid,
}: WorkbookSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = workbooks.find((wb) => wb.id === value);

  const handleSelect = (id: string | undefined) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">{selected ? selected.name : triggerPlaceholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {noneLabel && (
                <CommandItem
                  value={`${noneLabel} ${NONE_VALUE}`}
                  onSelect={() => handleSelect(undefined)}
                >
                  <Check className={cn("h-4 w-4", !selected ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{noneLabel}</span>
                </CommandItem>
              )}
              {workbooks.map((wb) => (
                <CommandItem
                  key={wb.id}
                  value={`${wb.name} ${wb.id}`}
                  onSelect={() => handleSelect(wb.id)}
                >
                  <Check className={cn("h-4 w-4", value === wb.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{wb.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
