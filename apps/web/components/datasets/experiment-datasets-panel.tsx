"use client";

import { useExperimentDatasets } from "@/hooks/dataset/useExperimentDatasets/useExperimentDatasets";
import { Package } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { ExperimentDatasetsTable } from "./experiment-datasets-table";
import { PublishDatasetButton } from "./publish-dataset-button";

interface ExperimentDatasetsPanelProps {
  experimentId: string;
  /** An experiment's admins and members publish; other viewers only read. */
  canPublish: boolean;
  /** Only admins withdraw a dataset or open its embargoed files early. */
  canManage?: boolean;
  /** Once the standards block is above the list, Publish a dataset is its last row instead. */
  showsPublishButton?: boolean;
}

export function ExperimentDatasetsPanel({
  experimentId,
  canPublish,
  canManage = false,
  showsPublishButton = true,
}: ExperimentDatasetsPanelProps) {
  const { t } = useTranslation("datasets");
  const { data: datasets, isLoading, isError, refetch } = useExperimentDatasets(experimentId);

  const handleRetry = () => {
    void refetch();
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (isError || datasets === undefined) {
    return (
      <EmptyState
        variant="error"
        description={t("list.loadError")}
        action={
          <Button variant="outline" size="sm" onClick={handleRetry}>
            {t("list.retry")}
          </Button>
        }
      />
    );
  }

  const draft = datasets.find((dataset) => dataset.state === "draft");
  const publishButton =
    canPublish && showsPublishButton ? (
      <PublishDatasetButton experimentId={experimentId} draft={draft} />
    ) : undefined;

  if (datasets.length === 0) {
    return (
      <EmptyState
        icon={<Package aria-hidden />}
        title={t("list.emptyTitle")}
        description={t("list.empty")}
        action={publishButton}
      />
    );
  }

  return (
    <div className="space-y-3" data-testid="experiment-datasets">
      {publishButton ? <div className="flex justify-end">{publishButton}</div> : null}
      <ExperimentDatasetsTable datasets={datasets} canPublish={canPublish} canManage={canManage} />
    </div>
  );
}
