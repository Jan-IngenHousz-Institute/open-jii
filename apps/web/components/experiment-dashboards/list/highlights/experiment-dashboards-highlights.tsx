"use client";

import { useMemo } from "react";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { Skeleton } from "@repo/ui/components/skeleton";

import { HighlightCard } from "./highlight-card";

interface ExperimentDashboardsHighlightsProps {
  dashboards: ExperimentDashboard[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
  count?: number;
}

const THUMBNAIL_MAX_HEIGHT_PX = 220;

export default function ExperimentDashboardsHighlights({
  dashboards,
  experimentId,
  isLoading,
  isArchived = false,
  count = 3,
}: ExperimentDashboardsHighlightsProps) {
  const basePath = isArchived ? "experiments-archive" : "experiments";

  const featured = useMemo(
    () =>
      [...dashboards]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, count),
    [dashboards, count],
  );

  if (!isLoading && featured.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {isLoading
        ? Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-[320px] w-full rounded-xl" />
          ))
        : featured.map((dashboard) => (
            <HighlightCard
              key={dashboard.id}
              dashboard={dashboard}
              href={`/platform/${basePath}/${experimentId}/dashboards/${dashboard.id}`}
              thumbnailMaxHeight={THUMBNAIL_MAX_HEIGHT_PX}
            />
          ))}
    </div>
  );
}
