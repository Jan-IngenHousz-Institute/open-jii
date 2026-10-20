"use client";

import { OverviewTable } from "@/components/overview-table/overview-table";
import { useDatasets } from "@/hooks/dataset/useDatasets/useDatasets";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { useId, useState } from "react";

import type { Dataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";

import { getDatasetCatalogueColumns } from "./dataset-catalogue-columns";

export function DatasetsCatalogue() {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);
  const mineId = useId();
  const [isMineOnly, setIsMineOnly] = useState(false);
  const { data: datasets, isLoading, error, refetch } = useDatasets(isMineOnly ? "related" : "all");

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
      <div className="flex items-center gap-2">
        <Switch id={mineId} checked={isMineOnly} onCheckedChange={setIsMineOnly} />
        <Label htmlFor={mineId} className="font-normal">
          {t("catalogue.mine")}
        </Label>
      </div>

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
        emptyMessage={t("catalogue.empty")}
      />
    </div>
  );
}
