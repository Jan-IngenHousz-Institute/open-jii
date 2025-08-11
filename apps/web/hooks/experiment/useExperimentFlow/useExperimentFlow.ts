import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch the flow for a specific experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the experiment flow
 */
export const useExperimentFlow = (experimentId: string) => {
  return tsr.experiments.getFlow.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experimentFlow", experimentId],
    enabled: !!experimentId,
  });
};