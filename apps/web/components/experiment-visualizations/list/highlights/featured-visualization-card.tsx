"use client";

import { formatDate } from "@/util/date";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useInView } from "@repo/ui/hooks/use-in-view";

import ExperimentVisualizationRenderer from "../../experiment-visualization-renderer";

interface FeaturedVisualizationCardProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  href: string;
}

/** Matches the dashboards card, so both analysis tabs read the same way. */
export function FeaturedVisualizationCard({
  visualization,
  experimentId,
  href,
}: FeaturedVisualizationCardProps) {
  const { t } = useTranslation("experimentVisualizations");
  // Every slide is in the DOM, so an eager preview would mount one Plotly chart
  // per visualization at once.
  const [inViewRef, mounted] = useInView<HTMLDivElement>({ rootMargin: "200px" });

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="space-y-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            <Link
              href={href}
              className="hover:text-foreground focus-visible:ring-primary/40 focus-visible:outline-hidden inline-flex max-w-full items-center gap-1.5 transition-colors hover:underline focus-visible:ring-2"
            >
              <span className="truncate">{visualization.name}</span>
              <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
            </Link>
          </h3>
          <p className="text-muted-foreground text-xs">
            {t("ui.labels.updatedAgo", { date: formatDate(visualization.updatedAt) })}
            {visualization.createdByName ? <> · {visualization.createdByName}</> : null}
          </p>
        </div>
        <div ref={inViewRef} className="h-[320px] w-full">
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
