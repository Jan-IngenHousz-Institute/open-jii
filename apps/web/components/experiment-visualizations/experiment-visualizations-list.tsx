"use client";

import { formatDate } from "@/util/date";
import { Calendar, ChevronRight, User } from "lucide-react";
import Link from "next/link";
import React from "react";

import type {
  ChartFamily,
  ChartType,
  ExperimentVisualization,
} from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";

import { getChartTypeDef } from "./charts/registry";

interface ExperimentVisualizationsListProps {
  visualizations: ExperimentVisualization[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

// Badge color is keyed off the chart family so the list scales to all 20+
// chart types without per-type bookkeeping. Unsupported types fall through
// to the neutral "archived" token.
const FAMILY_BADGE_CLASS: Record<ChartFamily, string> = {
  basic: "bg-badge-published",
  statistical: "bg-badge-stale",
  scientific: "bg-badge-archived",
  "3d": "bg-badge-archived",
};

function getChartTypeBadgeClass(chartType: ChartType): string {
  const family = getChartTypeDef(chartType)?.family;
  return family ? FAMILY_BADGE_CLASS[family] : "bg-badge-archived";
}

export default function ExperimentVisualizationsList({
  visualizations,
  experimentId,
  isLoading,
  isArchived = false,
}: ExperimentVisualizationsListProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  // Generate the correct base path based on archive status
  const basePath = isArchived ? "experiments-archive" : "experiments";

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }

  if (visualizations.length === 0) {
    return <span>{t("ui.messages.noVisualizations")}</span>;
  }

  return (
    <>
      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visualizations.map((visualization) => (
          <Link
            key={visualization.id}
            href={`/platform/${basePath}/${experimentId}/analysis/visualizations/${visualization.id}`}
          >
            <div className="bg-card relative flex h-full min-h-[180px] flex-col gap-3 rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg">
              <div className="mb-auto">
                <div className="mb-2 flex items-start gap-2">
                  <h3 className="text-foreground line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold md:text-lg">
                    {visualization.name}
                  </h3>
                </div>
                <span
                  className={`text-muted-dark mb-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${getChartTypeBadgeClass(
                    visualization.chartType,
                  )}`}
                >
                  {(() => {
                    const def = getChartTypeDef(visualization.chartType);
                    return def ? t(def.labelKey) : visualization.chartType;
                  })()}
                </span>
                <div className="text-muted-foreground mt-2 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>
                      {visualization.createdByName ??
                        visualization.createdBy.substring(0, 8) + "..."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {tCommon("common.updated")} {formatDate(visualization.updatedAt)}
                    </span>
                  </div>
                </div>
                {visualization.description && (
                  <p
                    data-testid="visualization-description"
                    className="text-muted-foreground mt-2 line-clamp-2 text-sm"
                  >
                    {visualization.description.length > 120
                      ? `${visualization.description.substring(0, 120)}...`
                      : visualization.description}
                  </p>
                )}
              </div>
              <ChevronRight className="text-foreground absolute bottom-5 right-5 h-6 w-6 md:hidden" />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
