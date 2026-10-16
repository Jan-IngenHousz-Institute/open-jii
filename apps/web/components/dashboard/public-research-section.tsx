"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ExperimentOverviewCard, hasBadges } from "~/components/experiment-overview-card";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";
import { listItems } from "@repo/api/shared/listing";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { PUBLIC_EXPERIMENTS_PAGE_SIZE, publicExperimentsQuery } from "./dashboard-queries";
import { DashboardSection } from "./dashboard-section";
import { SeeAllLink } from "./see-all-link";

const PUBLIC_EXPERIMENTS_HREF = "/platform/experiments?visibility=public";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// Two across at most, by the width of the `@container` around it rather than the window.
const gridClassName = "grid grid-cols-1 gap-4 @xl:grid-cols-2";

/**
 * The most recently updated public experiments, an even number of them so no card sits
 * alone on a row. Adds a notice when the newest update is more than 30 days old.
 */
export function PublicResearchSection() {
  const { t } = useTranslation();
  const locale = useLocale();
  const format = useLocalDateFormat(locale);

  const { data, isError, refetch } = useQuery(publicExperimentsQuery(orpc));

  const frame = (body: ReactNode) => (
    <DashboardSection
      id="public-research"
      title={t("dashboard.publicResearch")}
      action={
        <SeeAllLink href={`/${locale}${PUBLIC_EXPERIMENTS_HREF}`}>
          {t("dashboard.seeAll")}
        </SeeAllLink>
      }
    >
      {body}
    </DashboardSection>
  );

  if (isError) {
    return frame(
      <div className="border-border text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 text-center">
        <p>{t("dashboard.publicExperimentsLoadFailed")}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          {t("errors.tryAgain")}
        </Button>
      </div>,
    );
  }

  if (!data) {
    return frame(
      <div className="@container">
        <div aria-busy="true" className={gridClassName}>
          {Array.from({ length: PUBLIC_EXPERIMENTS_PAGE_SIZE }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      </div>,
    );
  }

  const experiments = listItems(data);
  if (experiments.length === 0) return null;

  const evenCount = experiments.length - (experiments.length % 2);
  const shown = experiments.length > 1 ? experiments.slice(0, evenCount) : experiments;
  const reserveBadgeRow = shown.some((experiment) => hasBadges(experiment));

  const renderCard = (experiment: ExperimentListItem) => (
    <ExperimentOverviewCard
      key={experiment.id}
      experiment={experiment}
      href={`/${locale}/platform/experiments/${experiment.id}`}
      locale={locale}
      reserveBadgeRow={reserveBadgeRow}
      showUpdatedLabel
    />
  );

  const latestUpdate = experiments[0].updatedAt;
  const isStale = Date.now() - new Date(latestUpdate).getTime() > STALE_AFTER_MS;

  return frame(
    <div className="space-y-3">
      {isStale ? (
        <p className="text-muted-foreground text-sm">
          {t("dashboard.publicExperimentsStale", { date: format.date(latestUpdate) })}{" "}
          <IntentLink
            href={`/${locale}${PUBLIC_EXPERIMENTS_HREF}`}
            className="text-primary hover:text-primary/80 font-semibold"
          >
            {t("dashboard.browsePublicExperiments")}
          </IntentLink>
        </p>
      ) : null}
      <div className="@container">
        <div className={gridClassName}>{shown.map(renderCard)}</div>
      </div>
    </div>,
  );
}
