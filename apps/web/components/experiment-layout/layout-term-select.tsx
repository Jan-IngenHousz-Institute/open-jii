"use client";

import { useExperimentLayoutTermSearch } from "@/hooks/experiment/useExperimentLayoutTermSearch/useExperimentLayoutTermSearch";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import type { LayoutTerm } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
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

interface LayoutTermSelectProps {
  id?: string;
  value: LayoutTerm | null | undefined;
  onChange: (term: LayoutTerm | null) => void;
}

const NONE_VALUE = "__none__";

/**
 * Searchable Common Greenhouse Ontology picker. cmdk's own filter stays off because the server
 * already matched the terms by name.
 */
export function LayoutTermSelect({ id, value, onChange }: LayoutTermSelectProps) {
  const { t } = useTranslation("experiments");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: terms = [], isFetching } = useExperimentLayoutTermSearch(search);

  const hasQuery = search.trim().length >= 2;
  const matches = hasQuery ? terms : [];
  const hasNoMatch = hasQuery && !isFetching && matches.length === 0;
  const hasTerm = value !== null && value !== undefined;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
    }
  };

  const handleSelect = (term: LayoutTerm | null) => {
    onChange(term);
    handleOpenChange(false);
  };

  const clearTerm = () => {
    handleSelect(null);
  };

  const renderTerm = (term: LayoutTerm) => (
    <CommandItem key={term.id} value={term.id} onSelect={() => handleSelect(term)}>
      <Check className={cn("size-4", value?.id === term.id ? "opacity-100" : "opacity-0")} />
      <div className="min-w-0 flex-1">
        <span className="block truncate">{term.label}</span>
        <span className="text-muted-foreground block truncate font-mono text-xs">{term.id}</span>
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
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !hasTerm && "text-muted-foreground")}
        >
          <span className="truncate">
            {hasTerm
              ? t("layout.term.selected", { label: value.label, id: value.id })
              : t("layout.term.none")}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("layout.term.searchPlaceholder")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {hasNoMatch ? (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {t("layout.term.noMatches")}
              </p>
            ) : null}
            {matches.length > 0 ? (
              <CommandGroup heading={t("layout.term.ontology")}>
                {matches.map(renderTerm)}
              </CommandGroup>
            ) : null}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value={NONE_VALUE} onSelect={clearTerm}>
                <Check className={cn("size-4", hasTerm ? "opacity-0" : "opacity-100")} />
                <span className="truncate">{t("layout.term.none")}</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
