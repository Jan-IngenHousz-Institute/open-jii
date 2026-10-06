"use client";

import { useLocale } from "@/hooks/useLocale";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { FirstWorkCards } from "~/components/dashboard/first-work-cards";
import { ExperimentOverviewCard, hasBadges } from "~/components/experiment-overview-card";
import { ResourceCardGrid } from "~/components/shared/resource-card";

import { Skeleton } from "@repo/ui/components/skeleton";

export function UserExperimentsSection() {
  const locale = useLocale();
  const { data: experiments } = useQuery(
    orpc.experiments.listRecentlyOpenedExperiments.queryOptions({
      input: { scope: "related", limit: 3 },
    }),
  );

  if (!experiments) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
    );
  }

  if (experiments.length === 0) {
    return <FirstWorkCards />;
  }

  const visits = experiments.map(({ openedAt, callerRole }) => ({ openedAt, callerRole }));
  const reserveBadgeRow = experiments.some((experiment, index) =>
    hasBadges(experiment, visits[index]),
  );

  return (
    <ResourceCardGrid>
      {experiments.map((experiment, index) => (
        <ExperimentOverviewCard
          key={experiment.id}
          experiment={experiment}
          href={`/${locale}/platform/experiments/${experiment.id}`}
          locale={locale}
          reserveBadgeRow={reserveBadgeRow}
          visit={visits[index]}
        />
      ))}
    </ResourceCardGrid>
  );
}
