import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch users who are not members of an experiment
 * @param experimentId The ID of the experiment
 * @returns Query result containing the available users
 */
export const useUsersNotOnExperiment = (experimentId: string) => {
  return tsr.experiments.getUsersNotOnExperiment.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["users-not-on-experiment", experimentId],
  });
};
