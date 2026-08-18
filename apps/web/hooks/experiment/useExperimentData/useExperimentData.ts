import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createTableColumns,
  sortColumnsForDisplay,
} from "~/components/data-table/data-table-columns";
import type {
  DataRenderFunction,
  DataRow,
  TableMetadata,
} from "~/components/data-table/data-table-columns";
import { orpc } from "~/lib/orpc";

import type { ExperimentAnnotationType } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { zExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

export interface UseExperimentDataParams {
  experimentId: string;
  page: number;
  pageSize: number;
  tableName: string;
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  /**
   * Optional structured filter conditions. Forwarded to the backend as a
   * JSON-encoded query param. When non-empty the backend's ad-hoc path
   * takes over from the paginated read: the response is the full filtered
   * result capped by the server's hard limit, `totalPages` is always 1,
   * and `totalRows` reports the row count returned (not the unfiltered
   * table size).
   */
  filters?: ExperimentDataFilter[];
  formatFunction?: DataRenderFunction;
  onChartClick?: (data: number[], columnName: string) => void;
  onAddAnnotation?: (rowIds: string[], type: ExperimentAnnotationType) => void;
  onDeleteAnnotations?: (rowIds: string[], type: ExperimentAnnotationType) => void;
  onToggleCellExpansion?: (rowId: string, columnName: string) => void;
  isCellExpanded?: (rowId: string, columnName: string) => boolean;
  errorColumn?: string;
  enabled?: boolean;
}

function compactFilters(
  filters: ExperimentDataFilter[] | undefined,
): ExperimentDataFilter[] | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }
  const compact = filters.filter((f) => zExperimentDataFilter.safeParse(f).success);
  return compact.length > 0 ? compact : undefined;
}

/**
 * Hook to fetch experiment data by ID using regular pagination
 * @param params Parameters for fetching experiment data
 * @param params.experimentId The ID of the experiment to fetch
 * @param params.tableName Name of the table to fetch
 * @param params.page Page to fetch; pages start with 1
 * @param params.pageSize Page size to fetch
 * @param params.orderBy Optional column name to order results by
 * @param params.orderDirection Optional sort direction for ordering (ASC or DESC)
 * @param params.formatFunction Function used to render the column value
 * @param params.onChartClick Event handler for when a chart is clicked
 * @param params.onAddAnnotation Event handler for adding annotations
 * @param params.onDeleteAnnotations Event handler for deleting annotations
 * @param params.onToggleCellExpansion Event handler for toggling cell expansion
 * @param params.isCellExpanded Function to check if cell is expanded
 * @param params.errorColumn Optional error column name
 * @returns Query result containing the experiment data
 */
export const useExperimentData = (params: UseExperimentDataParams) => {
  const {
    experimentId,
    page,
    pageSize,
    tableName,
    orderBy,
    orderDirection,
    filters,
    formatFunction,
    onChartClick,
    onAddAnnotation,
    onDeleteAnnotations,
    onToggleCellExpansion,
    isCellExpanded,
    errorColumn,
    enabled = true,
  } = params;

  const cleanedFilters = compactFilters(filters);
  // Stable JSON for both cache key and request encoding so semantically
  // identical filter sets share a query cache entry.
  const filtersJson = useMemo(
    () =>
      cleanedFilters && cleanedFilters.length > 0 ? JSON.stringify(cleanedFilters) : undefined,
    [cleanedFilters],
  );

  const { data, isLoading, error } = useQuery(
    orpc.experiments.getExperimentData.queryOptions({
      input: {
        id: experimentId,
        tableName,
        page,
        pageSize,
        orderBy,
        orderDirection,
        filters: filtersJson,
      },
      staleTime: STALE_TIME,
      enabled,
    }),
  );

  const tableData = data?.[0];

  const tableMetadata: TableMetadata | undefined = useMemo(() => {
    return tableData
      ? {
          columns: createTableColumns({
            columns: tableData.data?.columns,
            formatFunction,
            onChartClick,
            onAddAnnotation,
            onDeleteAnnotations,
            onToggleCellExpansion,
            isCellExpanded,
            errorColumn,
          }),
          totalPages: tableData.totalPages,
          totalRows: tableData.totalRows,
          // Same display order as `columns` above so downstream consumers
          // (filter pickers, dashboard table-widget column picker, etc.)
          // present columns in the canonical "timestamps first, then by
          // type" sequence rather than whatever raw order Databricks
          // returned.
          rawColumns: tableData.data
            ? sortColumnsForDisplay(
                tableData.data.columns.map((col) => ({
                  name: col.name,
                  type_name: col.type_name,
                  type_text: col.type_text,
                })),
              )
            : undefined,
          errorColumn,
        }
      : undefined;
  }, [
    tableData,
    formatFunction,
    onChartClick,
    onAddAnnotation,
    onDeleteAnnotations,
    onToggleCellExpansion,
    isCellExpanded,
    errorColumn,
  ]);
  const tableRows: DataRow[] | undefined = tableData?.data?.rows;

  return { tableMetadata, tableRows, isLoading, error };
};
