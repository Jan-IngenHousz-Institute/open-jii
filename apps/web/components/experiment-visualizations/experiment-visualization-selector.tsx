"use client";

import { useEffect, useState } from "react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

import { useExperimentVisualizationData } from "../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import ExperimentVisualizationRenderer from "./experiment-visualization-renderer";

interface ExperimentVisualizationSelectorProps {
  experimentId: string;
  visualizations: ExperimentVisualization[];
  isLoading?: boolean;
}

export default function ExperimentVisualizationSelector({
  experimentId,
  visualizations,
  isLoading = false,
}: ExperimentVisualizationSelectorProps) {
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
        <CardHeader>
          <CardTitle>{t("selector.title")}</CardTitle>
          <CardDescription>{t("selector.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">{t("loading")}</div>
        </CardContent>
      </Card>
    );
  }

  if (visualizations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("selector.title")}</CardTitle>
          <CardDescription>{t("selector.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">{t("selector.noVisualizations")}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("selector.title")}</CardTitle>
        <CardDescription>{t("selector.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <label htmlFor="visualization-select" className="text-sm font-medium">
            {t("selector.selectVisualization")}
          </label>
          <Select value={selectedVisualizationId} onValueChange={setSelectedVisualizationId}>
            <SelectTrigger
              id="visualization-select"
              className="h-auto min-h-[2.5rem] w-full max-w-2xl py-2 text-left"
            >
              {selectedVisualization ? (
                <div className="flex flex-col items-start gap-1 text-left">
                  <span className="text-sm font-medium leading-tight">
                    {selectedVisualization.name}
                  </span>
                  <span className="text-muted-foreground text-xs capitalize">
                    {t(
                      `chartTypes.${selectedVisualization.chartType}`,
                      selectedVisualization.chartType,
                    )}
                  </span>
                </div>
              ) : (
                <SelectValue placeholder={t("selector.placeholder")} />
              )}
            </SelectTrigger>
            <SelectContent>
              {visualizations.map((visualization) => (
                <SelectItem key={visualization.id} value={visualization.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{visualization.name}</span>
                    {visualization.description && (
                      <span className="text-muted-foreground text-xs">
                        {visualization.description}
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs capitalize">
                      {t(`chartTypes.${visualization.chartType}`, visualization.chartType)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedVisualization && (
          <div className="mt-6">
            {isDataLoading ? (
              <div className="flex h-[400px] items-center justify-center">
                <div className="text-muted-foreground">Loading visualization data...</div>
              </div>
            ) : (
              <ExperimentVisualizationRenderer
                visualization={selectedVisualization}
                experimentId={experimentId}
                data={visualizationData?.rows ?? null}
                height={450}
                showTitle={false}
                showDescription={false}
                isPreview={false}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
