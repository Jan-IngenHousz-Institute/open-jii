"use client";

import { useState } from "react";

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

  const selectedVisualization = visualizations.find((viz) => viz.id === selectedVisualizationId);

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

  if (!visualizations || visualizations.length === 0) {
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
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="visualization-select" className="text-sm font-medium">
            {t("selector.selectVisualization")}
          </label>
          <Select
            value={selectedVisualizationId}
            onValueChange={setSelectedVisualizationId}
          >
            <SelectTrigger id="visualization-select">
              <SelectValue placeholder={t("selector.placeholder")} />
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
            <ExperimentVisualizationRenderer
              visualization={selectedVisualization}
              experimentId={experimentId}
              height={400}
              showTitle={false}
              showDescription={false}
              isPreview={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}