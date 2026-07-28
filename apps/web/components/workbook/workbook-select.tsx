"use client";

import { useWorkbookList } from "@/hooks/workbook/useWorkbookList/useWorkbookList";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { useTranslation } from "@repo/i18n";
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

interface WorkbookSelectProps {
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
 * Searchable workbook picker, backed by the server's full-text search so it matches
 * the same things the workbooks page does (name, creator, linked entities) and keeps
 * the server's ranking. cmdk's own filter stays off: the results are already
 * filtered, and its fuzzy match would re-filter them against the item `value`, which
 * carries the id so duplicate names stay distinct.
 */
export function WorkbookSelect({
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
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: workbooks = [], isSearching } = useWorkbookList({ search });

  // The "none" entry is synthetic rather than a server result, so it is matched here.
  const query = search.trim().toLowerCase();
  const showNone = !!noneLabel && (!query || noneLabel.toLowerCase().includes(query));

  // A narrowed or in-flight list can omit the selected workbook, so its name is
  // remembered to keep the trigger label stable. A settled unfiltered list is
  // authoritative: a selection missing from that one is gone, not merely filtered out.
  const seenNames = useRef(new Map<string, string>());
  for (const wb of workbooks) seenNames.current.set(wb.id, wb.name);
  const liveName = value ? workbooks.find((wb) => wb.id === value)?.name : undefined;
  const mayOmitSelection = !!query || isSearching;
  const selectedName =
    liveName ?? (value && mayOmitSelection ? seenNames.current.get(value) : undefined);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  const handleSelect = (id: string | undefined) => {
    onChange(id);
    handleOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
            !selectedName && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">{selectedName ?? triggerPlaceholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            {isSearching && workbooks.length === 0 ? (
              <div
                role="status"
                className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("experiments.searchingWorkbooks")}
              </div>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            {/* Rows held over from the previous query are dimmed, so it is visible that
                they are not yet an answer to what is currently typed. */}
            <CommandGroup className={cn(isSearching && workbooks.length > 0 && "opacity-60")}>
              {showNone && (
                <CommandItem value={NONE_VALUE} onSelect={() => handleSelect(undefined)}>
                  <Check className={cn("h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{noneLabel}</span>
                </CommandItem>
              )}
              {workbooks.map((wb) => (
                <CommandItem key={wb.id} value={wb.id} onSelect={() => handleSelect(wb.id)}>
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
