import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch all metadata records for an experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the list of experiment metadata records
 */
export const useExperimentMetadata = (experimentId: string) => {
  return tsr.experiments.listExperimentMetadata.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment", experimentId, "metadata"],
  });
};
