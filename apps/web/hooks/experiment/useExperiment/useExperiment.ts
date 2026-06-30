import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch a single experiment by ID
 * @param experimentId The ID of the experiment to fetch
 * @param userId The ID of the current user for authentication
 * @returns Query result containing the experiment details
 */
export const useExperiment = (experimentId: string) => {
  return useQuery(orpc.experiments.getExperiment.queryOptions({ input: { id: experimentId } }));
};
