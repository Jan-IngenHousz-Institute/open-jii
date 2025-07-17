import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch protocols associated with an experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the experiment protocols
 */
export const useExperimentProtocols = (experimentId: string) => {
  return tsr.experiments.listExperimentProtocols.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment-protocols", experimentId],
  });
};
