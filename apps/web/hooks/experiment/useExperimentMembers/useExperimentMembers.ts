import { ExperimentMember } from "@repo/api";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch members of an experiment
 * @param experimentId The ID of the experiment
 * @param userId The ID of the current user for authentication
 * @returns Query result containing the experiment members
 */
export const useExperimentMembers = (experimentId: string, userId: string) => {
  return tsr.experiments.listExperimentMembers.useQuery({
    queryData: { params: { id: experimentId }, query: { userId } },
    queryKey: ["experiment-members", experimentId, userId],
  });
};
