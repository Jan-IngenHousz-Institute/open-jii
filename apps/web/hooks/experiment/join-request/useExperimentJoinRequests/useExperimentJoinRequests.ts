import { tsr } from "@/lib/tsr";

/**
 * Admin hook: lists pending join requests for an experiment.
 */
export const useExperimentJoinRequests = (experimentId: string, enabled = true) => {
  return tsr.experiments.listJoinRequests.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment-join-requests", experimentId],
    enabled: !!experimentId && enabled,
  });
};
