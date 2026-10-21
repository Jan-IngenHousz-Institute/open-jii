"use client";

import { useExperimentColumnTermSearch } from "@/hooks/experiment/useExperimentColumnTermSearch/useExperimentColumnTermSearch";
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

interface ColumnTermSelectProps {
  id?: string;
  value: ColumnTerm | null;
  /** The trait's own choice: looked, and nothing fits. Absent where a term is only optional. */
  isNoTermFits?: boolean;
  disabled?: boolean;
  onSelect: (term: ColumnTerm) => void;
  onClear: () => void;
  onNoTermFits?: () => void;
}

const NONE_VALUE = "__none__";

/**
 * Searchable Crop Ontology picker, built like the Common Greenhouse Ontology picker on the layout
 * setup card. cmdk's own filter stays off because the server already matched the terms by name.
 */
export function ColumnTermSelect({
  id,
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
  const { data, isFetching, isError } = useExperimentColumnTermSearch(search);

  const hasQuery = search.trim().length >= 2;
  const terms = hasQuery ? (data?.terms ?? []) : [];
  const isSearching = hasQuery && isFetching;
  const hasNoMatch = hasQuery && !isFetching && !isError && terms.length === 0;
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

  const renderTerm = (term: ColumnTerm) => (
    <CommandItem key={term.id} value={term.id} onSelect={() => handleSelect(term)}>
      <Check
        className={cn("size-4 shrink-0", value?.id === term.id ? "opacity-100" : "opacity-0")}
      />
      <div className="min-w-0 flex-1">
        <span className="block truncate">{term.label}</span>
        <span className="text-muted-foreground block truncate font-mono text-xs">{term.id}</span>
        {term.definition && (
          <span className="text-muted-foreground line-clamp-2 block text-xs">
            {term.definition}
          </span>
        )}
      </div>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
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
            {!hasQuery && (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {t("describe.term.hint")}
              </p>
            )}
            {isSearching && (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {t("describe.term.searching")}
              </p>
            )}
            {isError && (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {t("describe.term.unreachable")}
              </p>
            )}
            {hasNoMatch && (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {t("describe.term.noMatches")}
              </p>
            )}
            {terms.length > 0 && (
              <CommandGroup heading={t("describe.term.ontology")}>
                {terms.map(renderTerm)}
              </CommandGroup>
            )}
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
