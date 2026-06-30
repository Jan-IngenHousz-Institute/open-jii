import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

export const useExperimentJoinRequests = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listJoinRequests.queryOptions({
      input: { id: experimentId },
      enabled: !!experimentId,
    }),
  );
};
