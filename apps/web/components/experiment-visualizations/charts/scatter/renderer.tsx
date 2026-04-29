"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import React from "react";

import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";
import type { ScatterSeriesData } from "@repo/ui/components/charts/scatter-chart";
import { ScatterChart } from "@repo/ui/components/charts/scatter-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { useExperimentVisualizationData } from "../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { dataSourcesByRole } from "../form-values";
import type { ChartRendererProps } from "../types";

export function ScatterRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const xColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "x")[0]?.source.columnName;
  const yEntries = dataSourcesByRole(visualization.dataConfig.dataSources, "y");
  const colorEntries = dataSourcesByRole(visualization.dataConfig.dataSources, "color");

  const {
    data: fetchedData,
    isLoading,
    error,
  } = useExperimentVisualizationData(
    experimentId,
    {
      tableName: visualization.dataConfig.tableName,
      columns: visualization.dataConfig.dataSources.map((ds) => ds.columnName),
      orderBy: xColumn,
      orderDirection: "ASC",
    },
    !providedData,
  );

  const chartData = providedData ?? fetchedData?.rows ?? [];

  if (isLoading && !providedData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t("errors.loadingData")}</div>
      </div>
    );
  }

  if (error && !providedData) {
    return (
      <div className="bg-muted/30 text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed p-8">
        <div className="text-center">
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="mb-2 font-medium">{t("errors.failedToLoadData")}</div>
          <div className="text-sm">
            <Trans
              i18nKey="errors.failedToLoadDataDescription"
              ns="experimentVisualizations"
              components={{
                configLink:
                  visualization.id && visualization.id !== "preview" ? (
                    <Link
                      href={`/platform/experiments/${experimentId}/analysis/visualizations/${visualization.id}/edit`}
                      className="text-foreground underline hover:opacity-80"
                    />
                  ) : (
                    <span className="text-foreground" />
                  ),
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!Array.isArray(chartData) || chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="mb-2 text-lg font-medium">{t("errors.noData")}</div>
          <div className="text-sm">{t("errors.noDataFound")}</div>
        </div>
      </div>
    );
  }

  try {
    if (!visualization.config || visualization.chartType !== "scatter") {
      throw new Error(t("errors.invalidChartType"));
    }

    const effectiveYEntries =
      yEntries.length > 0
        ? yEntries
        : xColumn
          ? [
              {
                source: {
                  tableName: "",
                  columnName: xColumn,
                  alias: xColumn,
                  role: "y",
                },
                index: 0,
              },
            ]
          : [];

    if (effectiveYEntries.length === 0) {
      throw new Error(t("errors.yAxisNotConfigured"));
    }

    const useIndexForX = yEntries.length === 0 || !xColumn;

    const chartConfig = visualization.config as PlotlyChartConfig &
      Omit<ScatterSeriesData, "x" | "y">;

    const colorColumn = colorEntries[0]?.source.columnName;

    const scatterData: ScatterSeriesData[] = effectiveYEntries.map(({ source }, index) => {
      const xValues = useIndexForX
        ? chartData.map((_row, i) => i)
        : chartData.map((row) => {
            const value = row[xColumn as string];
            return typeof value === "string" || typeof value === "number" ? value : String(value);
          });
      const yValues = chartData.map((row) => {
        const value = row[source.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      let colorValues: string[] | undefined;
      if (colorColumn) {
        colorValues = chartData.map((row) => String(row[colorColumn]));
      }

      const name = source.alias ?? source.columnName;
      const color =
        colorValues ??
        (Array.isArray(chartConfig.color) ? chartConfig.color[index] : chartConfig.color);
      const colorscale = colorValues ? chartConfig.marker?.colorscale : undefined;
      const showscale = colorValues ? chartConfig.marker?.showscale : undefined;

      const colorbar =
        colorValues && chartConfig.marker?.showscale
          ? {
              title: {
                text: chartConfig.marker.colorbar?.title?.text,
                font: {
                  color: chartConfig.marker.colorbar?.title?.font?.color,
                  size: chartConfig.marker.colorbar?.title?.font?.size,
                  family: chartConfig.marker.colorbar?.title?.font?.family,
                },
                side: chartConfig.marker.colorbar?.title?.side,
              },
              thickness: 15,
              len: 0.9,
            }
          : undefined;

      return {
        x: xValues,
        y: yValues,
        name,
        mode: chartConfig.mode,
        marker: {
          size: chartConfig.marker?.size,
          symbol: chartConfig.marker?.symbol,
          color,
          colorscale,
          showscale,
          colorbar,
        },
        line: chartConfig.line,
        text: chartConfig.text,
        textposition: chartConfig.textposition,
        textfont: chartConfig.textfont,
        error_x: chartConfig.error_x,
        error_y: chartConfig.error_y,
        fill: chartConfig.fill,
        fillcolor: chartConfig.fillcolor,
        type: "scatter",
      };
    });

    return (
      <div className="flex h-full w-full flex-col">
        <ScatterChart data={scatterData} config={{ ...chartConfig, autosizable: true }} />
      </div>
    );
  } catch (err) {
    return (
      <div className="bg-muted/30 text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium">{t("errors.configurationError")}</div>
          <div className="text-sm">
            {err instanceof Error ? err.message : t("errors.invalidConfiguration")}
          </div>
        </div>
      </div>
    );
  }
}
