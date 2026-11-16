"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import type { ColumnTerm } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

import { TermSearchResults } from "./term-search-results";

interface ColumnTermSelectProps {
  id?: string;
  label: string;
  value: ColumnTerm | null;
  /** The property's own choice: looked, and nothing fits. Absent where a term is only optional. */
  isNoTermFits?: boolean;
  disabled?: boolean;
  onSelect: (term: ColumnTerm) => void;
  onClear: () => void;
  onNoTermFits?: () => void;
}

const NONE_VALUE = "__none__";

/**
 * Searchable term picker, built like the Common Greenhouse Ontology picker on the layout setup
 * card. cmdk's own filter stays off because the server already matched the terms by name.
 */
export function ColumnTermSelect({
  id,
  label,
  value,
  isNoTermFits = false,
  disabled = false,
  onSelect,
  onClear,
  onNoTermFits,
}: ColumnTermSelectProps) {
  const { t } = useTranslation("studyMetadata");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const hasTerm = value !== null;
  const hasChoice = hasTerm || isNoTermFits;
  const canDeclineTerm = onNoTermFits !== undefined;
  const isDeclineChosen = canDeclineTerm ? isNoTermFits : !hasTerm;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
    }
  };

  const handleSelect = (term: ColumnTerm) => {
    onSelect(term);
    handleOpenChange(false);
  };

  const handleDecline = () => {
    if (canDeclineTerm) {
      onNoTermFits();
    } else {
      onClear();
    }
    handleOpenChange(false);
  };

  const triggerText = () => {
    if (hasTerm) {
      return t("describe.term.selected", { label: value.label, id: value.id });
    }
    return isNoTermFits ? t("describe.term.noneFits") : t("describe.term.choose");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !hasChoice && "text-muted-foreground",
          )}
        >
          <span className="truncate">{triggerText()}</span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("describe.term.searchPlaceholder")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <TermSearchResults
              search={search}
              selectedId={value?.id ?? null}
              unreachableMessage={t("describe.term.unreachable")}
              onSelect={handleSelect}
            />
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value={NONE_VALUE} onSelect={handleDecline}>
                <Check className={cn("size-4", isDeclineChosen ? "opacity-100" : "opacity-0")} />
                <span className="truncate">
                  {canDeclineTerm ? t("describe.term.noneFits") : t("describe.term.none")}
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
