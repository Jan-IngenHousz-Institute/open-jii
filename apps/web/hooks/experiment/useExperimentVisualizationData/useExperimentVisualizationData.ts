import { tsr } from "~/lib/tsr";

// Time in ms before data is removed from the cache
const STALE_TIME = 2 * 60 * 1000;

/**
 * Configuration for targeting specific table and columns for visualization data
 */
export interface VisualizationDataConfig {
  tableName: string;
  columns?: string[]; // Optional: specific columns to fetch
  orderBy?: string; // Optional: column to order by
  orderDirection?: "ASC" | "DESC"; // Optional: sort direction
}

/**
 * Hook to fetch full experiment data for visualizations without pagination
 * @param experimentId The ID of the experiment to fetch
 * @param dataConfig Configuration specifying which table and columns to fetch
 * @param enabled Whether the query should run
 * @returns Query result containing the full experiment data
 */
export const useExperimentVisualizationData = (
  experimentId: string,
  dataConfig: VisualizationDataConfig,
  enabled = true,
) => {
  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: {
        tableName: dataConfig.tableName,
        columns: dataConfig.columns?.join(","),
        orderBy: dataConfig.orderBy,
        orderDirection: dataConfig.orderDirection,
      },
    },
    queryKey: [
      "experiment-visualization-data",
      experimentId,
      dataConfig.tableName,
      dataConfig.columns,
      dataConfig.orderBy,
      dataConfig.orderDirection,
    ],
    staleTime: STALE_TIME,
    enabled: enabled && !!dataConfig.tableName,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Extract the table data from the response
  const tableData = data?.body[0];

  return {
    data: tableData?.data,
    tableInfo: tableData
      ? {
          name: tableData.name,
          catalog_name: tableData.catalog_name,
          schema_name: tableData.schema_name,
          totalRows: tableData.totalRows,
        }
      : undefined,
    isLoading,
    error,
  };
};
