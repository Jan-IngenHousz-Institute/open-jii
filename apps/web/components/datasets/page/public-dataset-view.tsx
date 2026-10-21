"use client";

import { usePublicDataset } from "@/hooks/dataset/usePublicDataset/usePublicDataset";
import { getOrpcError } from "@/lib/orpc";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { DatasetStateBadge } from "../dataset-state-badge";
import { DatasetAuthors } from "./dataset-authors";
import { DatasetCiteAs } from "./dataset-cite-as";
import { DatasetFacts } from "./dataset-facts";
import { DatasetPublishedBody } from "./dataset-published-body";
import { DatasetStateNotices } from "./dataset-state-notices";
import { DatasetWithdrawalNotice } from "./dataset-withdrawal-notice";

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

  const { withdrawnAt, withdrawalReason } = dataset;
  const isWithdrawn = withdrawnAt !== null && withdrawalReason !== null;
  // A sandbox DOI is a test that may stop resolving, so no citation is offered for it.
  const offersCitation = dataset.depositEnvironment !== "sandbox";

  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{t("page.kind")}</Badge>
          {dataset.state === "published" ? null : <DatasetStateBadge state={dataset.state} />}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{dataset.title}</h1>
        <DatasetAuthors authors={dataset.authors} />
        <DatasetFacts dataset={dataset} />
      </header>

      <DatasetStateNotices dataset={dataset} />

      {isWithdrawn ? (
        <div className="space-y-3">
          <DatasetWithdrawalNotice
            withdrawnAt={withdrawnAt}
            reason={withdrawalReason}
            doi={dataset.doi}
            zenodoCopy={dataset.zenodoCopy}
          />
          <DatasetCiteAs citation={dataset.citation} isQuiet />
        </div>
      ) : (
        <>
          {offersCitation ? <DatasetCiteAs citation={dataset.citation} /> : null}
          <DatasetPublishedBody dataset={dataset} />
        </>
      )}
    </article>
  );
}
