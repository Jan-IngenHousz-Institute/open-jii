import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/lib/orpc";

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
  const { data, isLoading, isSuccess, error } = useQuery(
    orpc.experiments.getDistinctColumnValues.queryOptions({
      input: { id: experimentId, tableName, column, limit },
      staleTime: STALE_TIME,
      enabled: enabled && Boolean(experimentId) && Boolean(tableName) && Boolean(column),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: shouldRetryQuery,
    }),
  );

  return {
    values: data?.values ?? [],
    truncated: data?.truncated ?? false,
    isLoading,
    isSuccess,
    error,
  };
};
