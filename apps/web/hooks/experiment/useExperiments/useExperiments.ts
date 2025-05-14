import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch a list of experiments with optional filtering
 * @param userId The ID of the current user
 * @param filter Optional filter for experiments ('my', 'member', or 'related')
 * @returns Query result containing list of experiments
 */
export const useExperiments = (filter?: "my" | "member" | "related") => {
  return tsr.experiments.listExperiments.useQuery({
    queryData: { query: { filter } },
    queryKey: ["experiments", filter],
  });
};
