import { shouldRetryQuery } from "@/util/query-retry";
import { tsr } from "~/lib/tsr";

const STALE_TIME = 10 * 60 * 1000;

export interface UseExperimentDistinctValuesArgs {
  experimentId: string;
  tableName: string;
  column: string;
  limit?: number;
  enabled?: boolean;
}

export const useExperimentDistinctValues = ({
  experimentId,
  tableName,
  column,
  limit,
  enabled = true,
}: UseExperimentDistinctValuesArgs) => {
  const { data, isLoading, error } = tsr.experiments.getDistinctColumnValues.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { tableName, column, limit },
    },
    queryKey: ["experiment-distinct-values", experimentId, tableName, column, limit ?? null],
    staleTime: STALE_TIME,
    enabled: enabled && Boolean(experimentId) && Boolean(tableName) && Boolean(column),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: shouldRetryQuery,
  });

  return {
    values: data?.body.values ?? [],
    truncated: data?.body.truncated ?? false,
    isLoading,
    error,
  };
};
