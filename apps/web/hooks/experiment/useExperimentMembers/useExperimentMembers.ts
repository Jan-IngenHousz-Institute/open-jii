import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch members of an experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the experiment members
 */
export const useExperimentMembers = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentMembers.queryOptions({
      input: { id: experimentId },
    }),
  );
};
