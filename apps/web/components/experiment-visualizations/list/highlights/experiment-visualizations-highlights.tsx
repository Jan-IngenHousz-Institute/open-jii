"use client";

import { useMemo } from "react";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { Skeleton } from "@repo/ui/components/skeleton";

import { VisualizationHighlightCard } from "./visualization-highlight-card";

interface ExperimentVisualizationsHighlightsProps {
  visualizations: ExperimentVisualization[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
  count?: number;
}

const PREVIEW_HEIGHT_PX = 220;

/** The most recently touched charts, previewed above the table, as dashboards do. */
export default function ExperimentVisualizationsHighlights({
  visualizations,
  experimentId,
  isLoading,
  isArchived = false,
  count = 3,
}: ExperimentVisualizationsHighlightsProps) {
  const basePath = isArchived ? "experiments-archive" : "experiments";

  const featured = useMemo(
    () =>
      [...visualizations]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, count),
    [visualizations, count],
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
        : featured.map((visualization) => (
            <VisualizationHighlightCard
              key={visualization.id}
              visualization={visualization}
              experimentId={experimentId}
              href={`/platform/${basePath}/${experimentId}/analysis/visualizations/${visualization.id}`}
              previewHeight={PREVIEW_HEIGHT_PX}
            />
          ))}
    </div>
  );
}
