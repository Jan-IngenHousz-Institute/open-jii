"use client";

import { formatDate } from "@/util/date";
import { Calendar, ChevronRight, User } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components";

interface ExperimentVisualizationsListProps {
  visualizations: ExperimentVisualization[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

const getChartTypeDisplay = (chartType: string, t: (key: string) => string) => {
  switch (chartType.toLowerCase()) {
    case "line":
    case "lineplot":
      return t("charts.types.line");
    case "scatter":
    case "scatterplot":
      return t("charts.types.scatter");
    default:
      return chartType;
  }
};

const getChartTypeColor = (chartType: string) => {
  switch (chartType.toLowerCase()) {
    case "line":
    case "lineplot":
      return "bg-badge-published";
    case "scatter":
    case "scatterplot":
      return "bg-badge-stale";
    default:
      return "bg-badge-archived";
  }
};

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
            <div className="relative flex h-full min-h-[180px] flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:scale-[1.02] hover:shadow-lg">
              <div className="mb-auto">
                <div className="mb-2 flex items-start gap-2">
                  <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold text-gray-900 md:text-lg">
                    {visualization.name}
                  </h3>
                </div>
                <span
                  className={`text-muted-dark mb-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${getChartTypeColor(
                    visualization.chartType,
                  )}`}
                >
                  {getChartTypeDisplay(visualization.chartType, t)}
                </span>
                <div className="mt-2 space-y-2 text-sm text-gray-500">
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
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                    {visualization.description.length > 120
                      ? `${visualization.description.substring(0, 120)}...`
                      : visualization.description}
                  </p>
                )}
              </div>
              <ChevronRight className="absolute bottom-5 right-5 h-6 w-6 text-gray-900 md:hidden" />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
