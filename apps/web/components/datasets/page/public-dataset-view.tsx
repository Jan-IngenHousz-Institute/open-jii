"use client";

import { usePublicDataset } from "@/hooks/dataset/usePublicDataset/usePublicDataset";
import { getOrpcError } from "@/lib/orpc";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { DatasetArticle } from "./dataset-article";

/** Read in the browser so the scaffold's fixture can answer it; the real page renders on the server for crawlers. */
export function PublicDatasetView({ datasetId }: { datasetId: string }) {
  const { t } = useTranslation("datasets");
  const { data: dataset, isLoading, error, refetch } = usePublicDataset(datasetId);

  const handleRetry = () => {
    void refetch();
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // A Draft, a private experiment's dataset and an unknown id all answer not found alike.
  const isNotFound = getOrpcError(error)?.status === 404;

  if (isNotFound) {
    return <EmptyState size="page" description={t("page.notFound")} />;
  }

  if (error !== null || dataset === undefined) {
    return (
      <EmptyState
        size="page"
        variant="error"
        description={t("page.loadError")}
        action={
          <Button variant="outline" size="sm" onClick={handleRetry}>
            {t("page.retry")}
          </Button>
        }
      />
    );
  }

  return <DatasetArticle dataset={dataset} />;
}
