import {
  buildVisualizationDataRequest,
  remapVisualizationTable,
} from "@/features/experiment-visualizations/domain/chart-data";
import type { VisualizationDataConfig } from "@/features/experiment-visualizations/domain/chart-data";
import { shouldRetryQuery } from "@/shared/api/query-retry";
import { tsr } from "@/shared/api/tsr";
import { useMemo } from "react";

export type { VisualizationDataConfig };

const STALE_TIME = 2 * 60 * 1000;

export const useExperimentVisualizationData = (
  experimentId: string,
  dataConfig: VisualizationDataConfig,
  enabled = true,
) => {
  const request = buildVisualizationDataRequest(dataConfig);
  const aggregation = request.aggregation;

  const { data, isLoading, error } = tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: {
        tableName: dataConfig.tableName,
        columns: request.columnsCsv,
        filters: request.filtersJson,
        aggregation: request.aggregationJson,
        orderBy: request.orderBy,
        orderDirection: request.orderDirection,
      },
    },
    queryKey: [
      "experiment-visualization-data",
      experimentId,
      dataConfig.tableName,
      request.columnsCsv,
      request.filtersJson,
      request.aggregationJson,
      request.orderBy,
      request.orderDirection,
    ],
    staleTime: STALE_TIME,
    enabled: enabled && Boolean(dataConfig.tableName) && request.canQuery,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: shouldRetryQuery,
  });

  const tableData = data?.body[0];

  const remappedData = useMemo(
    () => (tableData?.data ? remapVisualizationTable(tableData.data, aggregation) : undefined),
    [tableData, aggregation],
  );

  return {
    data: remappedData,
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
