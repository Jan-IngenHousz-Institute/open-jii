"use client";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";

import { useExperimentVisualizationData } from "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";

export interface UseChartDataResult {
  rows: Record<string, unknown>[];
  isLoading: boolean;
  error: unknown;
}

/**
 * Resolve the rows a chart should render.
 *
 * If the caller already has rows in hand (e.g. the workspace canvas already
 * fetched them) we pass through and don't kick off a redundant query. The
 * read-only display path doesn't pre-fetch, so the hook fetches via the
 * shared `useExperimentVisualizationData` query — same query key as the
 * canvas, so TanStack dedupes on transient overlap.
 *
 * Empty `columnName`s (draft state) are filtered out before the request so
 * the API doesn't see invalid column lists.
 */
export function useChartData(
  visualization: ExperimentVisualization,
  experimentId: string,
  providedData: Record<string, unknown>[] | undefined,
  options: { orderBy?: string } = {},
): UseChartDataResult {
  const dataSourceColumns = visualization.dataConfig.dataSources
    .map((ds) => ds.columnName)
    .filter((name) => name.length > 0);
  // Pull filter columns into the projection too — otherwise `applyRowFilters`
  // would see `row[filterColumn] === undefined` for every row and exclude
  // them all, leaving the chart with an empty dataset whenever the filter
  // is on something other than X/Y/color.
  const filterColumns = (visualization.dataConfig.filters ?? [])
    .map((f) => f.column)
    .filter((name) => name.length > 0);
  const columns = Array.from(new Set([...dataSourceColumns, ...filterColumns]));

  const {
    data: fetched,
    isLoading,
    error,
  } = useExperimentVisualizationData(
    experimentId,
    {
      tableName: visualization.dataConfig.tableName,
      columns,
      orderBy: options.orderBy,
      orderDirection: options.orderBy ? "ASC" : undefined,
    },
    providedData === undefined,
  );

  if (providedData) {
    return { rows: providedData, isLoading: false, error: undefined };
  }
  return { rows: fetched?.rows ?? [], isLoading, error };
}
