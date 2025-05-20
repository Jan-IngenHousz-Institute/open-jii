import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch members of an experiment
 * @param experimentId The ID of the experiment
 * @param userId The ID of the current user for authentication
 * @returns Query result containing the experiment members
 */
export const useExperimentMembers = (experimentId: string) => {
  return tsr.experiments.listExperimentMembers.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment-members", experimentId],
  });
};
