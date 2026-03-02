import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch experiment metadata by experiment ID
 * @param experimentId The ID of the experiment
 * @returns Query result containing the experiment metadata
 */
export const useExperimentMetadata = (experimentId: string) => {
  return tsr.experiments.getExperimentMetadata.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment", experimentId, "metadata"],
  });
};
