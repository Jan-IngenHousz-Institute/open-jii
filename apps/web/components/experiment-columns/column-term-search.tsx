"use client";

import { useExperimentColumnTermSearch } from "@/hooks/experiment/useExperimentColumnTermSearch/useExperimentColumnTermSearch";
import { useDebounce } from "@/hooks/useDebounce";
import { Search, X } from "lucide-react";
import { useState } from "react";

import type { ColumnTerm } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";

interface ColumnTermSearchProps {
  value: ColumnTerm | null;
  onChange: (term: ColumnTerm | null) => void;
}

/** An optional Crop Ontology term for one field, found by searching its name. */
export function ColumnTermSearch({ value, onChange }: ColumnTermSearchProps) {
  const { t } = useTranslation("studyMetadata");
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query);
  const { data } = useExperimentColumnTermSearch(debouncedQuery);

  const terms = data?.terms ?? [];
  const hasQuery = debouncedQuery.trim().length >= 2;

  const handleSelect = (term: ColumnTerm) => {
    onChange(term);
    setIsOpen(false);
    setQuery("");
  };

  const handleClear = () => onChange(null);

  const renderTerm = (term: ColumnTerm) => (
    <CommandItem key={term.id} value={term.id} onSelect={() => handleSelect(term)}>
      <span className="min-w-0 flex-1 truncate">{term.label}</span>
      <span className="text-muted-foreground shrink-0 font-mono text-xs">{term.id}</span>
    </CommandItem>
  );

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{value.label}</Badge>
        <span className="text-muted-foreground font-mono text-xs">{value.id}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={t("describe.removeTerm")}
          onClick={handleClear}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        className="text-muted-foreground h-auto p-0 font-normal"
        onClick={() => setIsOpen(true)}
      >
        <Search className="mr-1 h-3.5 w-3.5" />
        {t("describe.findTerm")}
      </Button>
    );
  }

  return (
    <Command shouldFilter={false} className="rounded-md border">
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder={t("describe.termSearchPlaceholder")}
      />
      <CommandList>
        <CommandEmpty>{hasQuery ? t("describe.noTerms") : t("describe.termSearchHint")}</CommandEmpty>
        {terms.map(renderTerm)}
      </CommandList>
    </Command>
  );
}
