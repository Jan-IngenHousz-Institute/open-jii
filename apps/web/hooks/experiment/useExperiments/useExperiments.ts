import type { ExperimentStatus } from "@repo/api";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch a list of experiments with optional filtering
 * @param userId The ID of the current user
 * @param filter Optional filter for experiments ('my', 'member', or 'related')
 * @param status Optional filter for experiments by status ('provisioning', 'active', etc.)
 * @returns Query result containing list of experiments
 */
export const useExperiments = (
  filter?: "my" | "member" | "related",
  status?: ExperimentStatus,
) => {
  return tsr.experiments.listExperiments.useQuery({
    queryData: { query: { filter, status } },
    queryKey: ["experiments", filter, status],
  });
};
