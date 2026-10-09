"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { formatShortDate } from "@/util/date";
import { useQuery } from "@tanstack/react-query";
import { ExperimentOverviewCards } from "~/components/experiment-overview-cards";

import { listItems } from "@repo/api/shared/listing";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { PUBLIC_EXPERIMENTS_PAGE_SIZE, publicExperimentsQuery } from "./dashboard-queries";

const PUBLIC_EXPERIMENTS_HREF = "/platform/experiments?visibility=public";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const placeholderClassName =
  "border-border text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 text-center";

/**
 * Shows up to six public experiments, newest update first, with loading, error, and empty states.
 * Adds a notice when the most recent update is more than 30 days old.
 */
export function PublicExperimentsSection() {
  const { t } = useTranslation();
  const locale = useLocale();

  const { data, isError, refetch } = useQuery(publicExperimentsQuery(orpc));

  if (isError) {
    return (
      <div className={placeholderClassName}>
        <p>{t("dashboard.publicExperimentsLoadFailed")}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          {t("errors.tryAgain")}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: PUBLIC_EXPERIMENTS_PAGE_SIZE }).map((_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }

  const experiments = listItems(data);

  if (experiments.length === 0) {
    return (
      <div className={placeholderClassName}>
        <p>{t("dashboard.noPublicExperiments")}</p>
      </div>
    );
  }

  const latestUpdate = experiments[0].updatedAt;
  const isStale = Date.now() - new Date(latestUpdate).getTime() > STALE_AFTER_MS;

  return (
    <div className="space-y-4">
      {isStale ? (
        <p className="text-muted-foreground text-sm">
          {t("dashboard.publicExperimentsStale", {
            date: formatShortDate(latestUpdate, locale),
          })}{" "}
          <IntentLink
            href={`/${locale}${PUBLIC_EXPERIMENTS_HREF}`}
            className="text-primary hover:text-primary/80 font-semibold"
          >
            {t("dashboard.browsePublicExperiments")}
          </IntentLink>
        </p>
      ) : null}
      <ExperimentOverviewCards experiments={experiments} showUpdatedLabel />
    </div>
  );
}
