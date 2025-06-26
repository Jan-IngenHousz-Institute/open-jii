import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch a single experiment by ID
 * @param experimentId The ID of the experiment to fetch
 * @param userId The ID of the current user for authentication
 * @returns Query result containing the experiment details
 */
export const useExperiment = (experimentId: string) => {
  return tsr.experiments.getExperiment.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment", experimentId],
  });
};
