"use client";

import { useMemo } from "react";

import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { useExperimentVisualizationData } from "../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import type { VisualizationDataConfig } from "../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { useDashboardFiltersForTable } from "../../../experiment-dashboards/dashboard-filters-context";
import { useDashboardSharedRead } from "../../../experiment-dashboards/dashboard-shared-reads-context";
import type { OwnRead } from "../../../experiment-dashboards/dashboard-shared-reads-context";
import { dataSourcesByRole, readColumnsOf } from "../data/data-sources";
import { sortRowsByColumn } from "../data/row-order";
import { useProvidedReadTruncation } from "../provided-read-context";

/** How much of a read the chart holds when the backend stopped it short. */
export interface ChartTruncation {
  shown: number;
  total: number;
}

export function truncationOf(
  data: { rows: unknown[]; totalRows: number; truncated: boolean } | undefined,
): ChartTruncation | undefined {
  return data?.truncated ? { shown: data.rows.length, total: data.totalRows } : undefined;
}

export interface UseChartDataResult {
  rows: Record<string, unknown>[];
  isLoading: boolean;
  error: unknown;
  truncation?: ChartTruncation;
  /** The filters the read applied, the chart's own and a dashboard's together. */
  filters?: ExperimentDataFilter[];
}

// The data hook disables itself on an empty table name.
const NO_READ: VisualizationDataConfig = { tableName: "", columns: [] };

// Pass through providedData when available, otherwise fetch (TanStack dedupes).
export function useChartData(
  visualization: ExperimentVisualization,
  experimentId: string,
  providedData: Record<string, unknown>[] | undefined,
  options: { orderBy?: string; enabled?: boolean } = {},
): UseChartDataResult {
  const dataConfig = visualization.dataConfig;
  const columns = readColumnsOf(dataConfig.dataSources);

  // Keep color/facet columns through aggregation so the renderer can pivot.
  const colorColumn = dataSourcesByRole(dataConfig.dataSources, "color")[0]?.source.columnName;
  const facetColumn = dataSourcesByRole(dataConfig.dataSources, "facet")[0]?.source.columnName;
  const extraSplitColumns = [colorColumn, facetColumn].filter(
    (col): col is string => typeof col === "string" && col.length > 0,
  );
  const extraGroupByColumns = extraSplitColumns.length > 0 ? extraSplitColumns : undefined;

  // AND-merge dashboard filter widgets; empty outside a dashboard.
  const dashboardFilters = useDashboardFiltersForTable(dataConfig.tableName);
  const providedTruncation = useProvidedReadTruncation();
  const mergedFilters =
    dashboardFilters.length > 0
      ? [...(dataConfig.filters ?? []), ...dashboardFilters]
      : dataConfig.filters;

  // Pre-flight check so an orphan cumsum config renders inline, not a global toast.
  const aggregationError = validateAggregation(dataConfig.aggregation, options.orderBy);
  const canFetch =
    providedData === undefined && aggregationError === undefined && options.enabled !== false;

  // On a dashboard, charts on the same table with the same filters read once
  // through a shared plan; the plan's input becomes the query key they share.
  const own: OwnRead = {
    tableName: dataConfig.tableName,
    columns,
    filters: mergedFilters,
    aggregation: dataConfig.aggregation,
  };
  const shared = useDashboardSharedRead(visualization.id, own);
  const sharedRead = useExperimentVisualizationData(
    experimentId,
    shared
      ? {
          tableName: shared.tableName,
          columns: shared.columns,
          filters: shared.filters,
          orderBy: shared.orderBy,
          orderDirection: shared.orderBy ? "ASC" : undefined,
        }
      : NO_READ,
    canFetch && shared !== undefined,
  );
  // One stale column in any member fails the whole group; that chart reads alone.
  const sharedFailed = shared !== undefined && Boolean(sharedRead.error);
  const isSharing = shared !== undefined && !sharedFailed;

  const ownRead = useExperimentVisualizationData(
    experimentId,
    {
      tableName: dataConfig.tableName,
      columns,
      filters: mergedFilters,
      aggregation: dataConfig.aggregation,
      extraGroupByColumns,
      orderBy: options.orderBy,
      orderDirection: options.orderBy ? "ASC" : undefined,
    },
    canFetch && !isSharing,
  );

  const active = isSharing ? sharedRead : ownRead;

  // The group is ordered by one x; a member with another x sorts its own copy.
  const orderBy = options.orderBy;
  const ownOrderColumn =
    isSharing && orderBy !== undefined && orderBy !== shared.orderBy ? orderBy : undefined;
  const rows = useMemo(() => {
    const fetched = active.data?.rows ?? [];
    return ownOrderColumn === undefined ? fetched : sortRowsByColumn(fetched, ownOrderColumn);
  }, [active.data, ownOrderColumn]);

  if (providedData) {
    return {
      rows: providedData,
      isLoading: false,
      error: undefined,
      truncation: providedTruncation,
      filters: mergedFilters,
    };
  }
  if (aggregationError) {
    return { rows: [], isLoading: false, error: aggregationError };
  }
  return {
    rows,
    isLoading: active.isLoading,
    error: active.error,
    truncation: truncationOf(active.data),
    filters: mergedFilters,
  };
}

// Diagnostic code surfaced when cumsum is configured without a groupBy or
// explicit orderBy. Stable identifier (not English prose) so any renderer
// that wants to display this maps it through i18n.
export const CUMSUM_NEEDS_X_COLUMN = "cumsum-needs-x-column" as const;

// cumsum needs either a groupBy column or an explicit orderBy.
function validateAggregation(
  aggregation: ExperimentVisualization["dataConfig"]["aggregation"],
  orderBy: string | undefined,
): Error | undefined {
  const fns = aggregation?.functions ?? [];
  const hasCumsum = fns.some((f) => f.function === "cumsum");
  if (!hasCumsum) {
    return undefined;
  }
  const hasGroupBy = (aggregation?.groupBy?.length ?? 0) > 0;
  const hasOrderBy = Boolean(orderBy && orderBy.length > 0);
  if (hasGroupBy || hasOrderBy) {
    return undefined;
  }
  return new Error(CUMSUM_NEEDS_X_COLUMN);
}
