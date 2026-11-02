"use client";

import { CheckIcon } from "@radix-ui/react-icons";
import { ChevronRight, ListFilter as FilterIcon, Plus, X } from "lucide-react";
import * as React from "react";

import { Badge } from "./badge";
import { Button } from "./button";
import { Command, CommandGroup, CommandItem, CommandList } from "./command";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover";

interface ListFilterOption<T extends string> {
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

interface ListFilterChipsProps extends ListFilterMenuProps {
  onClear: () => void;
}

/** One chip per picked value, a button back to any filter not yet used, and "Clear filters". */
export function ListFilterChips({ filters, labels, onClear }: ListFilterChipsProps) {
  const chips = filters.flatMap((filter) =>
    filter.options
      .filter((option) => filter.selected.includes(option.value))
      .map((option) => ({ filter, option })),
  );

  if (chips.length === 0) {
    return null;
  }

  // Once every filter has a chip, each one's values open from its chips.
  const hasUnusedFilter = filters.some((filter) => filter.selected.length === 0);

  return (
    <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-md border p-2">
      {chips.map(({ filter, option }) => (
        <ValueChip
          key={`${filter.key}:${option.value}`}
          filter={filter}
          option={option}
          labels={labels}
        />
      ))}
      {hasUnusedFilter && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-7" aria-label={labels.addFilter}>
              <Plus aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <FilterPickerContent filters={filters} labels={labels} />
        </Popover>
      )}
      <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={onClear}>
        {labels.clearFilters}
      </Button>
    </div>
  );
}

function FilterPickerContent({ filters, labels }: ListFilterMenuProps) {
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

interface ValueChipProps {
  filter: ListFilter;
  option: ListFilterOption<string>;
  labels: ListFilterLabels;
}

function ValueChip({ filter, option, labels }: ValueChipProps) {
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

interface ValueListContentProps extends React.ComponentPropsWithoutRef<typeof PopoverContent> {
  filter: ListFilter;
}

function ValueListContent({ filter, ...props }: ValueListContentProps) {
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
