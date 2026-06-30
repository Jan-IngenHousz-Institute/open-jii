import { getOrpcError, orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch the flow for a specific experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the experiment flow
 */
export const useExperimentFlow = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getFlow.queryOptions({
      input: { id: experimentId },
      enabled: !!experimentId,
      retry(failureCount, error) {
        if (getOrpcError(error)?.status === 404) {
          return false; // no retries for missing flow
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }),
  );
};
