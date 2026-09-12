"use client";

import { useMemo } from "react";

import { useTranslation } from "@repo/i18n";
import { Alluvial } from "@repo/ui/components/charts/parallel-coordinates";
import { useChartThemeRefresh } from "@repo/ui/components/charts/use-chart-theme-refresh";

import { narrowChartConfig } from "../../chart-config";
import { ChartConfigError, ChartFrame } from "../../chart-frame";
import { useChartData } from "../../hooks/use-chart-data";
import type { ChartRendererProps } from "../../types";
import { transformAlluvialData } from "./transform";

export function AlluvialRenderer({
  visualization,
  experimentId,
  data: providedData,
}: ChartRendererProps) {
  const { t } = useTranslation("experimentVisualizations");

  const chartConfig = narrowChartConfig(visualization);
  const dataSources = visualization.dataConfig.dataSources;
  const stageCount = dataSources.filter(
    (ds) => ds.role === "groupBy" && ds.columnName.length > 0,
  ).length;

  const { rows, isLoading, error } = useChartData(visualization, experimentId, providedData, {
    enabled: stageCount >= 2,
  });

  // The transform below resolves category colours, so this has to re-run on a
  // theme swap or the traces keep the outgoing palette.
  const themeVersion = useChartThemeRefresh();

  // KEEP IN SYNC with the field reads in `transformAlluvialData`.
  const series = useMemo(() => {
    if (visualization.chartType !== "alluvial") {
      return [];
    }
    return transformAlluvialData(rows, dataSources, chartConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leaf-listed; see KEEP IN SYNC comment.
  }, [
    rows,
    dataSources,
    visualization.chartType,
    chartConfig.alluvialNodeThickness,
    chartConfig.alluvialNodePadding,
    chartConfig.alluvialLinkOpacity,
    chartConfig.alluvialColorMode,
    chartConfig.alluvialHideLabels,
    chartConfig.colorMap,
    themeVersion,
  ]);

  if (visualization.chartType !== "alluvial") {
    return <ChartConfigError message={t("errors.invalidConfiguration")} />;
  }

  const hasRows = stageCount >= 2 && rows.length > 0 && series.length > 0;

  return (
    <ChartFrame
      visualization={visualization}
      experimentId={experimentId}
      isLoading={isLoading}
      error={error}
      hasRows={hasRows}
    >
      <div className="flex h-full w-full flex-col">
        <Alluvial data={series} config={chartConfig} />
      </div>
    </ChartFrame>
  );
}
