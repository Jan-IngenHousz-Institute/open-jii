import { tsr } from "@/lib/tsr";
import { shouldRetryQuery } from "@/util/query-retry";

/**
 * Hook to fetch experiment details along with user access information
 * @param experimentId The ID of the experiment to fetch
 * @returns Query result containing the experiment details and access info
 */
export const useExperimentAccess = (experimentId: string) => {
  return tsr.experiments.getExperimentAccess.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experimentAccess", experimentId],
    retry: shouldRetryQuery,
  });
};
