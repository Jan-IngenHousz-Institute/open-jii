"use client";

import { useOrganismSearch } from "@/hooks/experiment/useOrganismSearch/useOrganismSearch";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import type { Organism } from "@repo/api/domains/experiment/study/experiment-study.schema";
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

/** A chosen organism. A name typed before the picker existed has no taxon. */
export interface OrganismChoice {
  name: string;
  taxonId: string | null;
}

interface OrganismSelectProps {
  id?: string;
  value: OrganismChoice | null;
  onSelect: (organism: OrganismChoice) => void;
  onClear: () => void;
}

const NONE_VALUE = "__none__";

/** NCBI Taxonomy picker, built like the column term picker. The server already matched by name. */
export function OrganismSelect({ id, value, onSelect, onClear }: OrganismSelectProps) {
  const { t } = useTranslation("studyMetadata");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isFetching, isError } = useOrganismSearch(search);

  const hasQuery = search.trim().length >= 2;
  const organisms = hasQuery ? (data?.organisms ?? []) : [];
  const isSearching = hasQuery && isFetching;
  const hasNoMatch = hasQuery && !isFetching && !isError && organisms.length === 0;
  const taxonId = value?.taxonId ?? null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
    }
  };

  const handleSelect = (organism: Organism) => {
    onSelect({ name: organism.name, taxonId: organism.taxonId });
    handleOpenChange(false);
  };

  const handleClear = () => {
    onClear();
    handleOpenChange(false);
  };

  const renderOrganism = (organism: Organism) => (
    <CommandItem
      key={organism.taxonId}
      value={organism.taxonId}
      onSelect={() => handleSelect(organism)}
    >
      <Check
        className={cn(
          "size-4 shrink-0",
          value?.taxonId === organism.taxonId ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="min-w-0 flex-1">
        <span className="block truncate italic">{organism.name}</span>
        {organism.commonName && (
          <span className="text-muted-foreground block truncate text-xs">
            {organism.commonName}
          </span>
        )}
      </div>
      <span className="text-muted-foreground shrink-0 font-mono text-xs">
        {t("organism.taxonId", { id: organism.taxonId })}
      </span>
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
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span className={cn("truncate", value && "italic")}>
              {value ? value.name : t("organism.choose")}
            </span>
            {taxonId && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {t("organism.taxonId", { id: taxonId })}
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("organism.searchPlaceholder")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!hasQuery && (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {t("organism.hint")}
              </p>
            )}
            {isSearching && (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {t("organism.searching")}
              </p>
            )}
            {isError && (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {t("organism.unreachable")}
              </p>
            )}
            {hasNoMatch && (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                {t("organism.noMatches")}
              </p>
            )}
            {organisms.length > 0 && (
              <CommandGroup heading={t("organism.source")}>
                {organisms.map(renderOrganism)}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value={NONE_VALUE} onSelect={handleClear}>
                <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
                <span className="truncate">{t("organism.none")}</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
