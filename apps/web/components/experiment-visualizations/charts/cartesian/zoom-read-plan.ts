import type { ExperimentSeriesTraceType } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import type { ChartFormDataConfig, RenderedChartConfig } from "../chart-config";
import { dataSourcesByRole, firstDataSourceByRole, readColumnsOf } from "../data/data-sources";

/** The columns a zoom read of a chart names. */
export interface ZoomReadPlan {
  xColumn: string;
  scale: "time" | "number";
  yColumns: string[];
  splitColumns: string[];
  readColumns: string[];
}

// The bucket query aliases and groups by these names, so each must be a plain SQL identifier.
const PLAIN_COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * What a zoom read of the chart asks for, or nothing when the chart cannot be drawn from buckets:
 * only unaggregated, unstacked, unfaceted line and area series over a time or numeric x qualify,
 * since the lowest and highest value per bucket is only faithful for a line.
 */
export function zoomReadPlanOf(
  dataConfig: ChartFormDataConfig,
  chartConfig: RenderedChartConfig,
  defaultTraceType: ExperimentSeriesTraceType,
  rows: readonly Record<string, unknown>[],
): ZoomReadPlan | undefined {
  const sources = dataConfig.dataSources;
  const xColumn = firstDataSourceByRole(sources, "x")?.source.columnName;
  const ySources = dataSourcesByRole(sources, "y").map(({ source }) => source);
  const colorColumn = firstDataSourceByRole(sources, "color")?.source.columnName;

  const isAggregated =
    (dataConfig.aggregation?.groupBy?.length ?? 0) > 0 ||
    (dataConfig.aggregation?.functions?.length ?? 0) > 0 ||
    ySources.some((source) => source.aggregate !== undefined);
  const isStacked = (chartConfig.stackMode ?? "none") !== "none";
  const hasLayoutSplit =
    dataSourcesByRole(sources, "facet").length > 0 || dataSourcesByRole(sources, "size").length > 0;
  const isLineOnly =
    ySources.length > 0 &&
    ySources.every((source, index) => {
      const traceType = index === 0 ? defaultTraceType : (source.traceType ?? defaultTraceType);
      return traceType === "line" || traceType === "area";
    });
  const splitColumns = colorColumn ? [colorColumn] : [];
  const yColumns = ySources.map((source) => source.columnName);
  const namesArePlain = [xColumn ?? "", ...yColumns, ...splitColumns].every((name) =>
    PLAIN_COLUMN.test(name),
  );

  if (!xColumn || isAggregated || isStacked || hasLayoutSplit || !isLineOnly || !namesArePlain) {
    return undefined;
  }

  const scale = scaleOf(rows.find((row) => row[xColumn] != null)?.[xColumn]);
  if (!scale) {
    return undefined;
  }

  return { xColumn, scale, yColumns, splitColumns, readColumns: readColumnsOf(sources) };
}

function scaleOf(value: unknown): "time" | "number" | undefined {
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const isNumeric = value.trim() !== "" && Number.isFinite(Number(value));
  if (isNumeric) {
    return "number";
  }
  return Number.isFinite(Date.parse(value)) ? "time" : undefined;
}
