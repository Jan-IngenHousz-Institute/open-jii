import { AlertCircle } from "lucide-react";
import Link from "next/link";
import React from "react";

import { useTranslation } from "@repo/i18n";
import { Trans } from "@repo/i18n/client";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import { LineChart } from "@repo/ui/components/charts/line-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

import { useExperimentVisualizationData } from "../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { dataSourcesByRole } from "../form-values";
import type { ChartRendererProps } from "../types";

export function LineRenderer({ visualization, experimentId, data: providedData }: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const xColumn = dataSourcesByRole(visualization.dataConfig.dataSources, "x")[0]?.source.columnName;
  const yEntries = dataSourcesByRole(visualization.dataConfig.dataSources, "y");

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
      <div className="bg-muted/20 flex h-full items-center justify-center rounded-lg border-2 border-dashed">
        <div className="text-center">
          <div className="text-muted-foreground mb-2 font-medium">{t("errors.noData")}</div>
          <div className="text-muted-foreground text-sm">{t("errors.noDataFound")}</div>
        </div>
      </div>
    );
  }

  try {
    if (!visualization.config || visualization.chartType !== "line") {
      throw new Error(t("errors.invalidConfiguration"));
    }

    // Fall back to using the X column as a single Y series when only X is picked,
    // and synthesize an index-based X axis when only Y is picked.
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

    const chartConfig = visualization.config as PlotlyChartConfig & Omit<LineSeriesData, "x" | "y">;

    const chartSeries: LineSeriesData[] = effectiveYEntries.map(({ source }, index) => {
      const xData = useIndexForX
        ? chartData.map((_row, i) => i)
        : chartData.map((row) => {
            const value = row[xColumn as string];
            return typeof value === "string" || typeof value === "number" ? value : String(value);
          });
      const yData = chartData.map((row) => {
        const value = row[source.columnName];
        return typeof value === "string" || typeof value === "number" ? value : String(value);
      });

      return {
        x: xData,
        y: yData,
        name: source.alias ?? source.columnName,
        color: Array.isArray(chartConfig.color) ? chartConfig.color[index] : chartConfig.color,
        mode: chartConfig.mode,
        line: chartConfig.line,
        marker: chartConfig.marker,
        connectgaps: chartConfig.connectgaps,
        fill: chartConfig.fill,
        fillcolor: chartConfig.fillcolor,
        text: chartConfig.text,
        textposition: chartConfig.textposition,
        textfont: chartConfig.textfont,
        error_x: chartConfig.error_x,
        error_y: chartConfig.error_y,
      };
    });

    return (
      <div className="flex h-full w-full flex-col">
        <LineChart data={chartSeries} config={chartConfig} />
      </div>
    );
  } catch (err) {
    return (
      <div className="bg-muted/30 text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <div className="mb-2 font-medium">{t("errors.configurationError")}</div>
          <div className="text-sm">
            {err instanceof Error ? err.message : t("errors.invalidConfiguration")}
          </div>
        </div>
      </div>
    );
  }
}
