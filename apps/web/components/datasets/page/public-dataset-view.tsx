"use client";

import { usePublicDataset } from "@/hooks/dataset/usePublicDataset/usePublicDataset";
import { Info } from "lucide-react";

import type { FundingReference } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { DatasetStateBadge } from "../dataset-state-badge";
import { DatasetAuthors } from "./dataset-authors";
import { DatasetCiteAs } from "./dataset-cite-as";
import { DatasetFacts } from "./dataset-facts";
import { DatasetFiles } from "./dataset-files";
import { DatasetWithdrawalNotice } from "./dataset-withdrawal-notice";

/** Read in the browser so the scaffold's fixture can answer it; the real page renders on the server for crawlers. */
export function PublicDatasetView({ datasetId }: { datasetId: string }) {
  const { t } = useTranslation("datasets");
  const { data: dataset, isLoading, isError } = usePublicDataset(datasetId);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || dataset === undefined) {
    return <EmptyState size="page" description={t("page.notFound")} />;
  }

  const { withdrawnAt, withdrawalReason } = dataset;
  const isWithdrawn = withdrawnAt !== null && withdrawalReason !== null;

  const renderFunding = (funding: FundingReference) => (
    <li key={funding.funderName}>
      {funding.awardNumber === null
        ? funding.funderName
        : t("page.fundingEntry", { funder: funding.funderName, award: funding.awardNumber })}
    </li>
  );

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

      <DatasetCiteAs citation={dataset.citation} />

      {isWithdrawn ? (
        <DatasetWithdrawalNotice withdrawnAt={withdrawnAt} reason={withdrawalReason} />
      ) : (
        <>
          <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-3 text-sm">
            <Info className="text-primary size-4 shrink-0" aria-hidden />
            <span className="leading-tight">{t("page.frozenNotice")}</span>
          </div>

          {dataset.description !== null ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">{t("page.description")}</h2>
              <p className="text-sm leading-relaxed">{dataset.description}</p>
            </section>
          ) : null}

          {dataset.funding.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">{t("page.funding")}</h2>
              <ul className="space-y-1 text-sm">{dataset.funding.map(renderFunding)}</ul>
            </section>
          ) : null}

          <DatasetFiles files={dataset.files} />
        </>
      )}
    </article>
  );
}
