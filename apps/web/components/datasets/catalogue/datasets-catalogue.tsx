"use client";

import { OverviewTable } from "@/components/overview-table/overview-table";
import { OverviewToolbar } from "@/components/overview-toolbar";
import { useDatasets } from "@/hooks/dataset/useDatasets/useDatasets";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { UserRound } from "lucide-react";
import { useState } from "react";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { SearchInput } from "@repo/ui/components/search-input";
import { Toggle } from "@repo/ui/components/toggle";

import { getDatasetCatalogueColumns } from "./dataset-catalogue-columns";

interface DatasetsCatalogueProps {
  /** Signed out there are no own experiments, so Mine is not offered. */
  canFilterMine: boolean;
}

/** The overview toolbar over every published dataset, as the experiments and workbooks lists have. */
export function DatasetsCatalogue({ canFilterMine }: DatasetsCatalogueProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);
  const [search, setSearch] = useState("");
  const [isMineOnly, setIsMineOnly] = useState(false);
  const {
    data: datasets,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useDatasets(isMineOnly ? "related" : "all", search);
  const hasSearch = search.trim() !== "";

  // A Draft has no page yet, so it opens where it is being finished.
  const getRowHref = (dataset: Dataset) =>
    dataset.state === "draft"
      ? `/${locale}/platform/experiments/${dataset.experimentId}/datasets/${dataset.id}/publish`
      : `/${locale}/datasets/${dataset.id}`;

  const handleRetry = () => {
    void refetch();
  };

  return (
    <div className="space-y-4" data-testid="datasets-catalogue">
      <OverviewToolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            isLoading={isFetching && hasSearch}
            placeholder={t("catalogue.searchPlaceholder")}
            clearLabel={t("catalogue.clearSearch")}
            loadingLabel={t("catalogue.searching")}
            className="w-full md:w-64"
          />
        }
        filters={
          canFilterMine ? (
            <Toggle
              variant="outline"
              size="sm"
              pressed={isMineOnly}
              onPressedChange={setIsMineOnly}
              className="h-9 border-dashed px-3 data-[state=on]:border-solid"
            >
              <UserRound aria-hidden />
              {t("catalogue.mine")}
            </Toggle>
          ) : undefined
        }
      />

      <OverviewTable
        columns={getDatasetCatalogueColumns({ t, formatDate: format.date })}
        items={datasets}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
        errorMessage={t("catalogue.loadError")}
        retryLabel={t("catalogue.retry")}
        getRowKey={(dataset) => dataset.id}
        getRowHref={getRowHref}
        emptyMessage={hasSearch ? t("catalogue.noMatches") : t("catalogue.empty")}
      />
    </div>
  );
}
