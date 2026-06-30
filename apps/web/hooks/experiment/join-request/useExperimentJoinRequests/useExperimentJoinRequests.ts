import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentJoinRequests = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listJoinRequests.queryOptions({
      input: { id: experimentId },
      enabled: !!experimentId,
    }),
  );
};
