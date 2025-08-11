import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch the flow for a specific experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the experiment flow
 */
export const useExperimentFlow = (experimentId: string) => {
  return tsr.experiments.getFlow.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experimentFlow", experimentId],
    enabled: !!experimentId,
    // React Query options (tsr wrapper spreads these into useQuery)
    retry(failureCount, error: unknown) {
      interface StatusError {
        status: number;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as StatusError).status === 404
      ) {
        return false; // no retries for missing flow
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
