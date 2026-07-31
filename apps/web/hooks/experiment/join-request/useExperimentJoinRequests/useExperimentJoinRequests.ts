import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Fetches manage-gated join requests when the caller's capability allows it. */
export const useExperimentJoinRequests = (
  experimentId: string,
  options?: { enabled?: boolean },
) => {
  return useQuery(
    orpc.experiments.listJoinRequests.queryOptions({
      input: { id: experimentId },
      enabled: !!experimentId && (options?.enabled ?? true),
    }),
  );
};
