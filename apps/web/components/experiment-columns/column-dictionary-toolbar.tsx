"use client";

import { Sparkles } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { ColumnDictionaryFilter } from "./column-dictionary-filter";
import type { DictionaryFilter } from "./dictionary-view";

interface ColumnDictionaryToolbarProps {
  described: number;
  total: number;
  filter: DictionaryFilter;
  hasSuggestions: boolean;
  canDescribe: boolean;
  onFilterChange: (filter: DictionaryFilter) => void;
  onReviewSuggestions: () => void;
}

export function ColumnDictionaryToolbar({
  described,
  total,
  filter,
  hasSuggestions,
  canDescribe,
  onFilterChange,
  onReviewSuggestions,
}: ColumnDictionaryToolbarProps) {
  const { t } = useTranslation("studyMetadata");

  const canReview = hasSuggestions && canDescribe;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <ColumnDictionaryFilter
          value={filter}
          hasSuggestions={hasSuggestions}
          onChange={onFilterChange}
        />
        <p className="text-muted-foreground text-sm">
          {t("dictionary.describedCount", { described, count: total })}
        </p>
      </div>
      {canReview && (
        <Button type="button" variant="outline" onClick={onReviewSuggestions}>
          <Sparkles />
          {t("dictionary.reviewSuggestions")}
        </Button>
      )}
    </div>
  );
}
