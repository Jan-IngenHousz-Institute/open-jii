"use client";

import type { UseFormReturn } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";

import { useExperimentVisualizationData } from "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import ExperimentVisualizationRenderer from "../experiment-visualization-renderer";

interface ChartPreviewProps {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
}

export function ChartPreview({ form, experimentId }: ChartPreviewProps) {
  const { t } = useTranslation("experimentVisualizations");
  const formValues = form.getValues();

  // Create a preview visualization object from current form values
  const previewVisualization: ExperimentVisualization = {
    id: "preview",
    name: formValues.name || t("charts.preview"),
    description: formValues.description ?? "",
    experimentId,
    chartType: formValues.chartType,
    chartFamily: "basic",
    dataConfig: {
      tableName: formValues.dataConfig.tableName,
      dataSources: formValues.dataConfig.dataSources.filter((ds) => ds.columnName),
    },
    config: formValues.config,
    createdBy: "preview-user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Get X-axis column for ordering
  const xDataSources = previewVisualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
  const xColumn = xDataSources[0]?.columnName;

  // Fetch data for the preview visualization
  const { data: visualizationData, isLoading: isDataLoading } = useExperimentVisualizationData(
    experimentId,
    previewVisualization.dataConfig.tableName
      ? {
          tableName: previewVisualization.dataConfig.tableName,
          columns: previewVisualization.dataConfig.dataSources.map((ds) => ds.columnName),
          orderBy: xColumn,
          orderDirection: "ASC",
        }
      : { tableName: "", columns: [] },
    !!previewVisualization.dataConfig.tableName &&
      previewVisualization.dataConfig.dataSources.length > 0,
  );

  if (!formValues.dataConfig.tableName) {
    return (
      <div className="bg-muted/50 flex h-full items-center justify-center rounded-lg border border-dashed">
        <div className="text-muted-foreground text-center">
          <div className="mb-2 text-lg font-medium">{t("preview.noDataSource")}</div>
          <div className="text-sm">{t("preview.selectTable")}</div>
        </div>
      </div>
    );
  }

  const configuredDataSources = formValues.dataConfig.dataSources.filter((ds) => ds.columnName);
  if (configuredDataSources.length === 0) {
    return (
      <div className="bg-muted/50 flex h-full items-center justify-center rounded-lg border border-dashed">
        <div className="text-muted-foreground text-center">
          <div className="mb-2 text-lg font-medium">{t("preview.noColumns")}</div>
          <div className="text-sm">{t("preview.configureColumns")}</div>
        </div>
      </div>
    );
  }

  if (isDataLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t("ui.messages.loadingData")}</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ExperimentVisualizationRenderer
        visualization={previewVisualization}
        experimentId={experimentId}
        data={visualizationData?.rows}
        showTitle={false}
        showDescription={false}
      />
    </div>
  );
}
