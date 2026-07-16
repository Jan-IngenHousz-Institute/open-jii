import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch locations of an experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the experiment locations
 */
export const useExperimentLocations = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentLocations.queryOptions({
      input: { id: experimentId },
    }),
  );
};
