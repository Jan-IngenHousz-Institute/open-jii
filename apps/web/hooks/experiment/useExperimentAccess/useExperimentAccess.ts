import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch experiment details along with user access information
 * @param experimentId The ID of the experiment to fetch
 * @returns Query result containing the experiment details and access info
 */
export const useExperimentAccess = (experimentId: string) => {
  return tsr.experiments.getExperimentAccess.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experimentAccess", experimentId],
    retry: (failureCount, error) => {
      // Don't retry on 4xx client errors - these are not transient
      const err = error as unknown;
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        typeof err.status === "number" &&
        err.status >= 400 &&
        err.status < 500
      ) {
        return false;
      }
      // Use default retry logic for other errors (up to 3 times)
      return failureCount < 3;
    },
  });
};
