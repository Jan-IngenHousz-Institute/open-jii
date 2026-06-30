import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch experiment details along with user access information
 * @param experimentId The ID of the experiment to fetch
 * @returns Query result containing the experiment details and access info
 */
export const useExperimentAccess = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentAccess.queryOptions({
      input: { id: experimentId },
      retry: shouldRetryQuery,
    }),
  );
};
