import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { useExperimentData } from "../useExperimentData/useExperimentData";

export interface ColumnMetadata {
  columns: DataColumn[];
  isLoading: boolean;
}

/**
 * Reads just the column metadata for a table by issuing the smallest possible
 * data fetch (pageSize: 1). Use when you need column schema but not rows.
 */
export function useColumnMetadata(
  experimentId: string,
  tableName: string | undefined,
): ColumnMetadata {
  const { tableMetadata, isLoading } = useExperimentData({
    experimentId,
    page: 1,
    pageSize: 1,
    tableName: tableName ?? "",
    enabled: Boolean(tableName),
  });
  return {
    columns: tableMetadata?.rawColumns ?? [],
    isLoading,
  };
}
