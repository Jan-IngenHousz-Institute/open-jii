"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import ExperimentVisualizationRenderer from "./experiment-visualization-renderer";

interface ExperimentVisualizationsDisplayProps {
  experimentId: string;
  visualizations: ExperimentVisualization[];
  isLoading?: boolean;
  isArchived?: boolean;
  hasAccess?: boolean;
}

export default function ExperimentVisualizationsDisplay({
  experimentId,
  visualizations,
  isLoading = false,
  isArchived = false,
  hasAccess = false,
}: ExperimentVisualizationsDisplayProps) {
  const { t } = useTranslation("experimentVisualizations");
  const [selectedVisualizationId, setSelectedVisualizationId] = useState<string>("");

  // Auto-select the first visualization when visualizations are loaded
  useEffect(() => {
    if (visualizations.length > 0 && !selectedVisualizationId) {
      setSelectedVisualizationId(visualizations[0].id);
    }
  }, [visualizations, selectedVisualizationId]);

  const selectedVisualization = visualizations.find((viz) => viz.id === selectedVisualizationId);

  // Get X-axis column for ordering
  const xDataSources = selectedVisualization?.dataConfig.dataSources.filter(
    (ds) => ds.role === "x",
  );
  const xColumn = xDataSources?.[0]?.columnName;

  // Fetch data for the selected visualization
  const { data: visualizationData, isLoading: isDataLoading } = useExperimentVisualizationData(
    experimentId,
    selectedVisualization
      ? {
          tableName: selectedVisualization.dataConfig.tableName,
          columns: selectedVisualization.dataConfig.dataSources.map((ds) => ds.columnName),
          orderBy: xColumn,
          orderDirection: "ASC",
        }
      : { tableName: "", columns: [] }, // Fallback when visualization not loaded
    !!selectedVisualization, // Only fetch when a visualization is selected
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-0">
        <div>
          <CardTitle>Visualizations</CardTitle>
          <CardDescription>{t("selector.noVisualizations")}</CardDescription>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-[250px] rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  if (visualizations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="p-0">
          <CardTitle>Visualizations</CardTitle>
          <CardDescription>{t("selector.noVisualizations")}</CardDescription>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-muted mb-4 flex h-24 w-24 items-center justify-center rounded-full">
              <svg
                className="text-muted-foreground h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            {isArchived || !hasAccess ? (
              <Button variant="outline" className="bg-surface-dark" disabled>
                Create visualization
              </Button>
            ) : (
              <Link
                href={`/en-US/platform/experiments/${experimentId}/analysis/visualizations`}
                passHref
              >
                <Button variant="outline" className="bg-surface-dark">
                  Create visualization
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div>
          <Select value={selectedVisualizationId} onValueChange={setSelectedVisualizationId}>
            <SelectTrigger className="h-auto w-fit border-none p-0 text-xl font-semibold shadow-none hover:bg-transparent focus:ring-0">
              {selectedVisualization ? (
                <span className="text-xl font-semibold">{selectedVisualization.name}</span>
              ) : (
                <span className="text-muted-foreground text-xl font-semibold">
                  Select a visualization
                </span>
              )}
            </SelectTrigger>
            <SelectContent>
              {visualizations.map((visualization) => (
                <SelectItem key={visualization.id} value={visualization.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{visualization.name}</span>
                    {visualization.description && (
                      <span className="text-muted-foreground text-xs">
                        {visualization.description.length > 60
                          ? `${visualization.description.substring(0, 60)}...`
                          : visualization.description}
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs capitalize">
                      {t(`charts.types.${visualization.chartType}`, visualization.chartType)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedVisualization && (
          <div className="mt-6 flex flex-col">
            {isDataLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">Loading visualization data...</div>
              </div>
            ) : (
              <ExperimentVisualizationRenderer
                visualization={selectedVisualization}
                experimentId={experimentId}
                data={visualizationData?.rows ?? null}
                showTitle={false}
                showDescription={false}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
