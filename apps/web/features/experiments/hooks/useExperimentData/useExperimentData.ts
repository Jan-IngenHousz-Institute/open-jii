import type { DataRow, TableMetadata } from "@/features/experiments/domain/data-table";
import {
  buildExperimentDataQuery,
  buildTableMetadata,
} from "@/features/experiments/domain/data-table";
import { tsr } from "@/shared/api/tsr";
import type React from "react";
import { useMemo } from "react";

import type { AnnotationType, DataFilter } from "@repo/api/schemas/experiment.schema";

export type { DataRow, TableMetadata };
export { sortColumnsForDisplay, getColumnWidth } from "@/features/experiments/domain/data-table";

export type DataRenderFunction = (
  value: unknown,
  type: string,
  rowId: string,
  columnName?: string,
  onChartClick?: (data: number[], columnName: string) => void,
  onAddAnnotation?: (rowIds: string[], type: AnnotationType) => void,
  onDeleteAnnotations?: (rowIds: string[], type: AnnotationType) => void,
  onToggleCellExpansion?: (rowId: string, columnName: string) => void,
  isCellExpanded?: (rowId: string, columnName: string) => boolean,
  errorColumn?: string,
) => string | React.JSX.Element;

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
  filters?: DataFilter[];
  formatFunction?: DataRenderFunction;
  onChartClick?: (data: number[], columnName: string) => void;
  onAddAnnotation?: (rowIds: string[]) => void;
  onDeleteAnnotations?: (rowIds: string[]) => void;
  onToggleCellExpansion?: (rowId: string, columnName: string) => void;
  isCellExpanded?: (rowId: string, columnName: string) => boolean;
  errorColumn?: string;
  enabled?: boolean;
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

  const { query, queryKey } = buildExperimentDataQuery({
    experimentId,
    tableName,
    page,
    pageSize,
    orderBy,
    orderDirection,
    filters,
  });

  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query,
    },
    queryKey,
    staleTime: STALE_TIME,
    enabled,
  });

  const tableData = data?.body[0];

  const tableMetadata: TableMetadata | undefined = useMemo(() => {
    return buildTableMetadata(tableData, {
      formatFunction,
      onChartClick,
      onAddAnnotation,
      onDeleteAnnotations,
      onToggleCellExpansion,
      isCellExpanded,
      errorColumn,
    });
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
