"use client";

import { formatDate } from "@/util/date";
import Link from "next/link";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useInView } from "@repo/ui/hooks/use-in-view";

import ExperimentVisualizationRenderer from "../../experiment-visualization-renderer";

export interface VisualizationHighlightCardProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  href: string;
  previewHeight: number;
}

/** The dashboards highlight card, for a chart: same anatomy, same whole-card link. */
export function VisualizationHighlightCard({
  visualization,
  experimentId,
  href,
  previewHeight,
}: VisualizationHighlightCardProps) {
  const { t } = useTranslation("experimentVisualizations");
  // A grid of previews would otherwise mount one Plotly chart per card at once.
  const [inViewRef, mounted] = useInView<HTMLDivElement>({ rootMargin: "200px" });

  const updatedLabel = t("ui.labels.updatedAgo", { date: formatDate(visualization.updatedAt) });
  const subtitle = visualization.createdByName
    ? `${updatedLabel} · ${visualization.createdByName}`
    : updatedLabel;

  return (
    <Card className="hover:border-foreground/20 group relative overflow-hidden shadow-none transition-colors">
      <Link
        href={href}
        aria-label={visualization.name}
        className="focus-visible:ring-primary/40 focus-visible:outline-hidden absolute inset-0 z-10 rounded-xl focus-visible:ring-2"
      />
      <CardContent className="space-y-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{visualization.name}</h3>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        <div ref={inViewRef} style={{ height: previewHeight }} className="w-full">
          {mounted ? (
            <ExperimentVisualizationRenderer
              visualization={visualization}
              experimentId={experimentId}
              showTitle={false}
              showDescription={false}
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
