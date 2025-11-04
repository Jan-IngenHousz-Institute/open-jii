"use client";

import { useEffect, useState } from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
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
}

export default function ExperimentVisualizationsDisplay({
  experimentId,
  visualizations,
  isLoading = false,
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

  // Fetch data for the selected visualization
  const { data: visualizationData, isLoading: isDataLoading } = useExperimentVisualizationData(
    experimentId,
    selectedVisualization
      ? {
          tableName: selectedVisualization.dataConfig.tableName,
          columns: selectedVisualization.dataConfig.dataSources.map((ds) => ds.columnName),
        }
      : { tableName: "", columns: [] }, // Fallback when visualization not loaded
    !!selectedVisualization, // Only fetch when a visualization is selected
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground text-sm">{t("ui.messages.loading")}</div>
        </CardContent>
      </Card>
    );
  }

  if (visualizations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-muted-foreground text-sm">{t("selector.noVisualizations")}</div>
        </CardContent>
      </Card>
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
