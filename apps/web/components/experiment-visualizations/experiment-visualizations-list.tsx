"use client";

import { formatDate } from "@/util/date";
import { ArrowRight, Calendar, User } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader } from "@repo/ui/components";

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
      return "bg-blue-100 text-blue-800";
    case "scatter":
    case "scatterplot":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
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
    return <div className="py-8 text-center">{tCommon("loading")}</div>;
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
            <Card className="flex h-full flex-col bg-white transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-2 overflow-hidden truncate whitespace-nowrap font-semibold text-gray-900">
                      {visualization.name}
                    </h3>
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getChartTypeColor(
                        visualization.chartType,
                      )}`}
                    >
                      {getChartTypeDisplay(visualization.chartType, t)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col space-y-4">
                <div className="space-y-2 text-sm text-gray-500">
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

                <div className="flex-1">
                  {visualization.description && (
                    <p className="line-clamp-2 text-sm text-gray-600">
                      {visualization.description.length > 120
                        ? `${visualization.description.substring(0, 120)}...`
                        : visualization.description}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  className="mt-auto h-auto w-full justify-between p-0 font-normal text-gray-700 hover:text-gray-900"
                >
                  {tCommon("experiments.viewDetails")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
