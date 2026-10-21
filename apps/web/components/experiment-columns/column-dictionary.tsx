"use client";

import { DocsHelpLink } from "@/components/docs-help-link";
import { useExperimentColumnDictionary } from "@/hooks/experiment/useExperimentColumnDictionary/useExperimentColumnDictionary";
import { useState } from "react";

import type {
  DictionaryColumn,
  DictionaryGroup,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ColumnDescribeDrawer } from "./column-describe-drawer";
import { ColumnDictionaryGroup } from "./column-dictionary-group";
import { ColumnDictionaryToolbar } from "./column-dictionary-toolbar";
import type { DictionaryEntry, DictionaryFilter } from "./dictionary-view";
import { DictionaryView } from "./dictionary-view";

interface ColumnDictionaryProps {
  experimentId: string;
  /** False for viewers who may not describe columns, and on an archived experiment. */
  canDescribe: boolean;
}

/** Every column the experiment has produced, grouped by what produced it. */
export function ColumnDictionary({ experimentId, canDescribe }: ColumnDictionaryProps) {
  const { t } = useTranslation("studyMetadata");
  const { data, isLoading, isError, refetch } = useExperimentColumnDictionary(experimentId);
  const [filter, setFilter] = useState<DictionaryFilter>("all");
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">{t("dictionary.loadFailed")}</p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          {t("dictionary.retry")}
        </Button>
      </div>
    );
  }

  const view = new DictionaryView(data);
  const selected = view.find(selectedIdentity);
  const visibleGroups = view.visibleGroups(filter);
  const isFilterEmpty = !view.isEmpty && visibleGroups.length === 0;
  const filterEmptyKey =
    filter === "suggested" ? "dictionary.noneSuggested" : "dictionary.allDescribed";

  const handleSelectColumn = (column: DictionaryColumn) => setSelectedIdentity(column.identity);

  const handleSelectEntry = (entry: DictionaryEntry) => setSelectedIdentity(entry.column.identity);

  const handleCloseDrawer = () => setSelectedIdentity(null);

  const handleReviewSuggestions = () => {
    const first = view.firstSuggested();
    setFilter("suggested");
    setSelectedIdentity(first?.column.identity ?? null);
  };

  const renderGroup = (group: DictionaryGroup, index: number) => (
    <ColumnDictionaryGroup
      key={index}
      group={group}
      canDescribe={canDescribe}
      onSelectColumn={handleSelectColumn}
    />
  );

  if (view.isEmpty) {
    return <p className="text-muted-foreground text-sm">{t("dictionary.empty")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <p className="text-muted-foreground text-sm">{t("dictionary.purpose")}</p>
        <DocsHelpLink path="/guide/data-analysis/viewing-data" label={t("dictionary.learnMore")} />
      </div>
      {!canDescribe && <p className="text-muted-foreground text-sm">{t("dictionary.readOnly")}</p>}
      <ColumnDictionaryToolbar
        described={view.described}
        total={view.total}
        filter={filter}
        hasSuggestions={view.hasSuggestions}
        canDescribe={canDescribe}
        onFilterChange={setFilter}
        onReviewSuggestions={handleReviewSuggestions}
      />
      {isFilterEmpty && <p className="text-muted-foreground text-sm">{t(filterEmptyKey)}</p>}
      {visibleGroups.map(renderGroup)}
      <ColumnDescribeDrawer
        experimentId={experimentId}
        view={view}
        filter={filter}
        selected={selected}
        canDescribe={canDescribe}
        onSelect={handleSelectEntry}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
