import type {
  ExperimentChartType,
  ExperimentSeriesTraceType,
  ExperimentVisualization,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { getColumnKind } from "@repo/api/transforms/column-type-utils";

import { narrowChartConfig } from "../chart-config";
import type { ChartFormDataConfig, RenderedChartConfig } from "../chart-config";
import { dataSourcesByRole, firstDataSourceByRole, readColumnsOf } from "../data/data-sources";

/** Buckets per window: one per pixel column on plots up to this many pixels wide. */
export const WINDOW_BUCKETS = 2_000;

/**
 * Above this many rows a series is drawn from buckets: the lowest and highest value of every pixel
 * column show all a plot can, so more rows only cost transfer.
 */
export const BUCKETED_ROWS = 2 * WINDOW_BUCKETS;

export type AxisScale = "time" | "number";

/** The columns a zoom read of a chart names. */
export interface ZoomReadPlan {
  xColumn: string;
  scale: AxisScale;
  yColumns: string[];
  splitColumns: string[];
  readColumns: string[];
}

// The bucket query aliases and groups by these names, so each must be a plain SQL identifier.
const PLAIN_COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// The chart types whose series can come from buckets, by the trace each draws unless told otherwise.
const BUCKETABLE_TRACES: Partial<Record<ExperimentChartType, ExperimentSeriesTraceType>> = {
  line: "line",
  area: "area",
};

/**
 * What a zoom read of the chart asks for, or nothing when the chart cannot be drawn from buckets:
 * only unaggregated, unstacked line and area series over a time or numeric x qualify, since the
 * lowest and highest value per bucket is only faithful for a line. Colour and facet cells are
 * bucketed apart; facets only when they share their x, so one window serves every cell.
 */
export function zoomReadPlanOf(
  dataConfig: ChartFormDataConfig,
  chartConfig: RenderedChartConfig,
  defaultTraceType: ExperimentSeriesTraceType,
  scale: AxisScale | undefined,
): ZoomReadPlan | undefined {
  const columns = bucketColumnsOf(dataConfig, chartConfig, defaultTraceType);

  return columns && scale ? { ...columns, scale } : undefined;
}

/**
 * Whether a saved chart is drawn from buckets, given its table's row count; undefined until that
 * count is known. Its x column's type is not checked here, so a chart over a categorical x counts
 * as bucketed and reads on its own.
 */
export function drawsFromBuckets(
  visualization: Pick<ExperimentVisualization, "chartType" | "dataConfig" | "config">,
  totalRows: number | undefined,
): boolean | undefined {
  const traceType = BUCKETABLE_TRACES[visualization.chartType];
  const isBucketable =
    traceType !== undefined &&
    bucketColumnsOf(visualization.dataConfig, narrowChartConfig(visualization), traceType) !==
      undefined;

  if (!isBucketable) {
    return false;
  }
  return totalRows === undefined ? undefined : totalRows > BUCKETED_ROWS;
}

/** The x axis's scale from its column's type, or from its first value when the type is unknown. */
export function xScaleOf(
  columnType: string | undefined,
  rows: readonly Record<string, unknown>[],
  xColumn: string | undefined,
): AxisScale | undefined {
  const kind = getColumnKind(columnType);
  if (kind === "numeric") {
    return "number";
  }
  if (kind === "temporal") {
    return "time";
  }
  if (kind !== undefined || xColumn === undefined) {
    return undefined;
  }
  return scaleOfValue(rows.find((row) => row[xColumn] != null)?.[xColumn]);
}

function bucketColumnsOf(
  dataConfig: ChartFormDataConfig,
  chartConfig: RenderedChartConfig,
  defaultTraceType: ExperimentSeriesTraceType,
): Omit<ZoomReadPlan, "scale"> | undefined {
  const sources = dataConfig.dataSources;
  const xColumn = firstDataSourceByRole(sources, "x")?.source.columnName;
  const ySources = dataSourcesByRole(sources, "y").map(({ source }) => source);
  const colorColumn = firstDataSourceByRole(sources, "color")?.source.columnName;
  const facetColumns = dataSourcesByRole(sources, "facet").map(({ source }) => source.columnName);

  const isAggregated =
    (dataConfig.aggregation?.groupBy?.length ?? 0) > 0 ||
    (dataConfig.aggregation?.functions?.length ?? 0) > 0 ||
    ySources.some((source) => source.aggregate !== undefined);
  const isStacked = (chartConfig.stackMode ?? "none") !== "none";
  const hasUnsharedFacets = facetColumns.length > 0 && chartConfig.facetSharedX === false;
  const hasSize = dataSourcesByRole(sources, "size").length > 0;
  const isLineOnly =
    ySources.length > 0 &&
    ySources.every((source, index) => {
      const traceType = index === 0 ? defaultTraceType : (source.traceType ?? defaultTraceType);
      return traceType === "line" || traceType === "area";
    });
  const splitColumns = [...(colorColumn ? [colorColumn] : []), ...facetColumns];
  const yColumns = ySources.map((source) => source.columnName);
  const namesArePlain = [xColumn ?? "", ...yColumns, ...splitColumns].every((name) =>
    PLAIN_COLUMN.test(name),
  );

  if (
    !xColumn ||
    isAggregated ||
    isStacked ||
    hasUnsharedFacets ||
    hasSize ||
    !isLineOnly ||
    !namesArePlain
  ) {
    return undefined;
  }

  return { xColumn, yColumns, splitColumns, readColumns: readColumnsOf(sources) };
}

function scaleOfValue(value: unknown): AxisScale | undefined {
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
