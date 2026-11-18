import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch all metadata records for an experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the list of experiment metadata records
 */
export const useExperimentMetadata = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentMetadata.queryOptions({
      input: { id: experimentId },
    }),
  );
};
