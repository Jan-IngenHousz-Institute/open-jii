import { tsr } from "@/lib/tsr";

export const useExperimentJoinRequests = (experimentId: string) => {
  return tsr.experiments.listJoinRequests.useQuery({
    queryData: { params: { id: experimentId } },
    queryKey: ["experiment-join-requests", experimentId],
    enabled: !!experimentId,
  });
};
