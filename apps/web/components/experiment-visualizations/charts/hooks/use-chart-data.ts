"use client";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";

import { useExperimentVisualizationData } from "../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { useDashboardFiltersForTable } from "../../../experiment-dashboards/dashboard-filters-context";
import { dataSourcesByRole } from "../data/data-sources";

export interface UseChartDataResult {
  rows: Record<string, unknown>[];
  isLoading: boolean;
  error: unknown;
}

// Pass through providedData when available, otherwise fetch (TanStack dedupes).
export function useChartData(
  visualization: ExperimentVisualization,
  experimentId: string,
  providedData: Record<string, unknown>[] | undefined,
  options: { orderBy?: string; enabled?: boolean } = {},
): UseChartDataResult {
  const dataConfig = visualization.dataConfig;
  // Project primary + errorColumn dedup'd.
  const columns = Array.from(
    new Set(
      dataConfig.dataSources
        .flatMap((ds) => [ds.columnName, ds.errorColumn])
        .filter((name): name is string => typeof name === "string" && name.length > 0),
    ),
  );

  // Keep color/facet columns through aggregation so the renderer can pivot.
  const colorColumn = dataSourcesByRole(dataConfig.dataSources, "color")[0]?.source.columnName;
  const facetColumn = dataSourcesByRole(dataConfig.dataSources, "facet")[0]?.source.columnName;
  const extraSplitColumns = [colorColumn, facetColumn].filter(
    (col): col is string => typeof col === "string" && col.length > 0,
  );
  const extraGroupByColumns = extraSplitColumns.length > 0 ? extraSplitColumns : undefined;

  // AND-merge dashboard filter widgets; empty outside a dashboard.
  const dashboardFilters = useDashboardFiltersForTable(dataConfig.tableName);
  const mergedFilters =
    dashboardFilters.length > 0
      ? [...(dataConfig.filters ?? []), ...dashboardFilters]
      : dataConfig.filters;

  // Pre-flight check so an orphan cumsum config renders inline, not a global toast.
  const aggregationError = validateAggregation(dataConfig.aggregation, options.orderBy);

  const {
    data: fetched,
    isLoading,
    error,
  } = useExperimentVisualizationData(
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
    providedData === undefined && aggregationError === undefined && options.enabled !== false,
  );

  if (providedData) {
    return { rows: providedData, isLoading: false, error: undefined };
  }
  if (aggregationError) {
    return { rows: [], isLoading: false, error: aggregationError };
  }
  return { rows: fetched?.rows ?? [], isLoading, error };
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
