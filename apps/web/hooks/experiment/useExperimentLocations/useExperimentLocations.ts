import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch locations of an experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the experiment locations
 */
export const useExperimentLocations = (experimentId: string) => {
  return tsr.experiments.getExperimentLocations.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment-locations", experimentId],
  });
};
