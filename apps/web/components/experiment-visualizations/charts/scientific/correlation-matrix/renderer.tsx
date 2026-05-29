"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { CorrelationMatrix } from "@repo/ui/components/charts/heatmap";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { resolveColorscale } from "../../colors/colorscales";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformCorrelationMatrixData } from "./transform";

export function CorrelationMatrixRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const distinctYCount = new Set(
    dataSources
      .filter((ds) => ds.role === "y" && ds.columnName.length > 0)
      .map((ds) => ds.columnName),
  ).size;

  // Skip the SQL request entirely when correlation can't be computed.
  // Fewer than 2 distinct picks means no pairs and the renderer shows
  // the empty-state. Without `enabled: false` the hook would still
  // fetch raw rows for the picked columns (noise that never gets used).
  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    enabled: distinctYCount >= 2,
  });

  const { matrix, labels } = useMemo(() => {
    if (visualization.chartType !== "correlation-matrix") {
      return { matrix: null, labels: [] };
    }
    return transformCorrelationMatrixData(rows, dataSources);
  }, [rows, dataSources, visualization.chartType]);

  if (visualization.chartType !== "correlation-matrix") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  // Specific message when fewer than 2 distinct columns are picked.
  // Without it the chart would just show the generic "no data"
  // empty-state, which doesn't tell the user what to do next.
  if (labels.length < 2) {
    return <ChartConfigError message={t("errors.correlationMatrixNeedsTwoColumns")} />;
  }

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={rows.length > 0 && matrix !== null}
    >
      <div className="flex h-full w-full flex-col">
        {matrix && (
          <CorrelationMatrix
            correlationMatrix={matrix}
            labels={labels}
            colorscale={resolveColorscale(chartConfig.corrColorscale ?? "RdBu")}
            reverseScale={Boolean(chartConfig.corrReverseScale)}
            showColorbar={chartConfig.corrShowColorbar !== false}
            showValues={chartConfig.corrShowValues !== false}
            textDecimals={Math.max(0, Math.floor(chartConfig.corrTextDecimals ?? 2))}
            config={chartConfig}
          />
        )}
      </div>
    </ChartFrame>
  );
}
