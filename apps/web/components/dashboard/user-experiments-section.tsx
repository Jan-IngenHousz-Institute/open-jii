"use client";

import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { FirstWorkCards } from "~/components/dashboard/first-work-cards";
import { ExperimentOverviewCard, hasBadges } from "~/components/experiment-overview-card";
import { ResourceCardGrid } from "~/components/shared/resource-card";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";

import { userExperimentsQuery } from "./dashboard-queries";
import { DashboardSection } from "./dashboard-section";

export function UserExperimentsSection() {
  const locale = useLocale();
  const { t } = useTranslation();
  const { data, isPending, isFetching, isError, refetch } = useQuery(userExperimentsQuery(orpc));
  const loading = isPending || isFetching;
  const title =
    !loading && !isError
      ? t(
          data.source === "recently-opened"
            ? "dashboard.recentlyOpenedExperiments"
            : "dashboard.yourExperiments",
        )
      : "";

  const content = () => {
    // Every mount rechecks access; cached cards are not confirmed while that read is pending.
    if (loading) {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div
          role="alert"
          className="border-border text-muted-foreground flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 text-center"
        >
          <p>{t("dashboard.userExperimentsLoadFailed")}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("dashboard.userExperimentsRetry")}
          </Button>
        </div>
      );
    }

    if (data.experiments.length === 0) return <FirstWorkCards />;

    const reserveBadgeRow = data.experiments.some((experiment) =>
      hasBadges(experiment, experiment),
    );

    return (
      <ResourceCardGrid>
        {data.experiments.map((experiment) => (
          <ExperimentOverviewCard
            key={experiment.id}
            experiment={experiment}
            href={`/${locale}/platform/experiments/${experiment.id}`}
            locale={locale}
            reserveBadgeRow={reserveBadgeRow}
            callerRole={experiment.callerRole}
            showUpdatedLabel
            visit={"openedAt" in experiment ? experiment : undefined}
          />
        ))}
      </ResourceCardGrid>
    );
  };

  return (
    <section aria-label={title || undefined} aria-busy={loading}>
      <DashboardSection
        title={title}
        seeAllLabel={t("dashboard.seeAll")}
        seeAllHref="/platform/experiments"
        locale={locale}
      >
        {content()}
      </DashboardSection>
    </section>
  );
}
