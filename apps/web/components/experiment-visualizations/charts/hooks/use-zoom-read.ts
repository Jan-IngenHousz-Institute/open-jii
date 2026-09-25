"use client";

import { shouldRetryQuery } from "@/util/query-retry";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "~/lib/orpc";

import { DATA_QUERY_MAX_LIMIT } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type {
  ExperimentDataAggregation,
  ExperimentDataFilter,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import { useExperimentVisualizationData } from "../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { axisPosition } from "../cartesian/series-reduction";
import type { AxisRange } from "../cartesian/series-reduction";

/** Buckets per window: one per pixel column on plots up to this many pixels wide. */
const WINDOW_BUCKETS = 2_000;
const STALE_TIME = 2 * 60 * 1000;

export interface ZoomReadInput {
  experimentId: string;
  tableName: string;
  filters: ExperimentDataFilter[] | undefined;
  xColumn: string;
  scale: "time" | "number";
  yColumns: string[];
  splitColumns: string[];
  readColumns: string[];
  window: AxisRange | undefined;
  enabled: boolean;
}

export interface ZoomRead {
  /** Rows to draw in place of the chart's own read, once the first answer is in. */
  rows: Record<string, unknown>[] | undefined;
  /** How many table rows the drawing stands for. */
  total: number | undefined;
  isBucketed: boolean;
}

/**
 * Reads for a series longer than one read can hold. The visible window comes back as the lowest
 * and highest value per bucket, one bucket per pixel column, so the whole series draws faithfully;
 * once the window holds few enough rows to read whole, its rows come back instead.
 */
export function useZoomRead(input: ZoomReadInput): ZoomRead {
  const { experimentId, tableName, filters, xColumn, scale, yColumns, splitColumns, enabled } =
    input;

  const extent = useQuery(
    orpc.experiments.getExperimentData.queryOptions({
      input: {
        id: experimentId,
        tableName,
        filters: filtersParam(filters),
        aggregation: JSON.stringify({
          functions: [
            { column: xColumn, function: "min", alias: "x_from" },
            { column: xColumn, function: "max", alias: "x_to" },
          ],
        } satisfies ExperimentDataAggregation),
      },
      enabled,
      staleTime: STALE_TIME,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: shouldRetryQuery,
    }),
  );

  const extentRow = extent.data?.[0]?.data?.rows[0];
  const fullRange = extentRow ? rangeOf(extentRow.x_from, extentRow.x_to) : undefined;
  const window = input.window ?? fullRange;
  const windowFilters = window ? [...(filters ?? []), windowFilter(xColumn, scale, window)] : [];

  const buckets = useQuery(
    orpc.experiments.getExperimentData.queryOptions({
      input: {
        id: experimentId,
        tableName,
        filters: filtersParam(windowFilters),
        aggregation: JSON.stringify(
          window ? bucketAggregation(xColumn, scale, yColumns, splitColumns, window) : {},
        ),
      },
      enabled: enabled && window !== undefined,
      placeholderData: keepPreviousData,
      staleTime: STALE_TIME,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: shouldRetryQuery,
    }),
  );

  const bucketRows = buckets.data?.[0]?.data?.rows;
  const total = bucketRows?.reduce((sum, row) => sum + Number(row.rows), 0);
  // While a new window's counts are loading, the previous window's stand in for the drawing, but
  // they say nothing about whether the new window fits in one read.
  const fitsOneRead =
    !buckets.isPlaceholderData && total !== undefined && total <= DATA_QUERY_MAX_LIMIT;

  const windowRead = useExperimentVisualizationData(
    experimentId,
    {
      tableName,
      columns: input.readColumns,
      filters: windowFilters,
      orderBy: xColumn,
      orderDirection: "ASC",
    },
    enabled && fitsOneRead,
  );

  const drawnBuckets = useMemo(
    () => (bucketRows ? bucketsToRows(bucketRows, xColumn, yColumns, splitColumns) : undefined),
    [bucketRows, xColumn, yColumns, splitColumns],
  );

  const windowRows = fitsOneRead ? windowRead.data?.rows : undefined;
  return {
    rows: windowRows ?? drawnBuckets,
    total,
    isBucketed: windowRows === undefined && drawnBuckets !== undefined,
  };
}

function filtersParam(filters: ExperimentDataFilter[] | undefined): string | undefined {
  return filters && filters.length > 0 ? JSON.stringify(filters) : undefined;
}

function rangeOf(from: unknown, to: unknown): AxisRange | undefined {
  const start = axisPosition(typeof from === "string" || typeof from === "number" ? from : null);
  const end = axisPosition(typeof to === "string" || typeof to === "number" ? to : null);
  return Number.isFinite(start) && Number.isFinite(end) && start < end ? [start, end] : undefined;
}

function windowFilter(
  xColumn: string,
  scale: "time" | "number",
  [from, to]: AxisRange,
): ExperimentDataFilter {
  const value =
    scale === "time" ? [new Date(from).toISOString(), new Date(to).toISOString()] : [from, to];
  return { column: xColumn, operator: "between", value };
}

function bucketAggregation(
  xColumn: string,
  scale: "time" | "number",
  yColumns: string[],
  splitColumns: string[],
  [from, to]: AxisRange,
): ExperimentDataAggregation {
  return {
    groupBy: [
      {
        column: xColumn,
        widthBucket: { origin: from, width: (to - from) / WINDOW_BUCKETS, scale },
      },
      ...splitColumns.map((column) => ({ column })),
    ],
    functions: [
      { column: xColumn, function: "min", alias: "x_from" },
      { column: xColumn, function: "max", alias: "x_to" },
      ...yColumns.flatMap((column, index) => [
        { column, function: "min" as const, alias: `y${index}_low` },
        { column, function: "max" as const, alias: `y${index}_high` },
      ]),
      { column: "*", function: "count", alias: "rows" },
    ],
  };
}

/**
 * Two rows per bucket in the chart's own column names: the lowest values where the bucket starts
 * and the highest where it ends, so a line through them covers every value the bucket held.
 */
function bucketsToRows(
  rows: Record<string, unknown>[],
  xColumn: string,
  yColumns: string[],
  splitColumns: string[],
): Record<string, unknown>[] {
  const ordered = [...rows].sort(
    (a, b) => axisPosition(cellOf(a.x_from)) - axisPosition(cellOf(b.x_from)),
  );

  return ordered.flatMap((row) => {
    const splits = Object.fromEntries(splitColumns.map((column) => [column, row[column]]));
    const low = Object.fromEntries(yColumns.map((column, i) => [column, row[`y${i}_low`]]));
    const high = Object.fromEntries(yColumns.map((column, i) => [column, row[`y${i}_high`]]));
    return [
      { ...splits, ...low, [xColumn]: row.x_from },
      { ...splits, ...high, [xColumn]: row.x_to },
    ];
  });
}

function cellOf(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}
