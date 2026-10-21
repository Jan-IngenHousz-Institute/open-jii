"use client";

import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { DictionaryFilter } from "./dictionary-view";

const FILTERS: readonly DictionaryFilter[] = ["all", "undescribed", "suggested"];

const FILTER_KEYS: Record<DictionaryFilter, string> = {
  all: "dictionary.filterAll",
  undescribed: "dictionary.filterUndescribed",
  suggested: "dictionary.filterSuggested",
};

interface ColumnDictionaryFilterProps {
  value: DictionaryFilter;
  hasSuggestions: boolean;
  onChange: (filter: DictionaryFilter) => void;
}

export function ColumnDictionaryFilter({
  value,
  hasSuggestions,
  onChange,
}: ColumnDictionaryFilterProps) {
  const { t } = useTranslation("studyMetadata");

  const handleChange = (next: string) => {
    const filter = FILTERS.find((candidate) => candidate === next);
    if (filter) {
      onChange(filter);
    }
  };

  const renderOption = (filter: DictionaryFilter) => (
    <SelectItem key={filter} value={filter}>
      {t(FILTER_KEYS[filter])}
    </SelectItem>
  );

  const options = FILTERS.filter((filter) => filter !== "suggested" || hasSuggestions);

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-52" aria-label={t("dictionary.filterLabel")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{options.map(renderOption)}</SelectContent>
    </Select>
  );
}
