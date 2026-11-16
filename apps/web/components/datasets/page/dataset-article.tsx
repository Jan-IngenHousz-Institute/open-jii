"use client";

import type { PublicDataset } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

import { DatasetStateBadge } from "../dataset-state-badge";
import { DatasetAuthors } from "./dataset-authors";
import { DatasetCiteAs } from "./dataset-cite-as";
import { DatasetFacts } from "./dataset-facts";
import { DatasetPublishedBody } from "./dataset-published-body";
import { DatasetStateNotices } from "./dataset-state-notices";
import { DatasetWithdrawalNotice } from "./dataset-withdrawal-notice";

/** A dataset's page as anyone reads it, and as a data steward previews it before approval. */
export function DatasetArticle({ dataset }: { dataset: PublicDataset }) {
  const { t } = useTranslation("datasets");

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
