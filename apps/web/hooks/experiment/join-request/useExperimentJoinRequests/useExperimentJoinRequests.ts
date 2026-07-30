import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Pending requests to join an experiment.
 *
 * The endpoint is gated on `can(manage)`: a request names the people asking for
 * access, which only whoever decides on them may read. Callers that already hold
 * a capability signal pass `enabled: false` to skip a request that could only
 * 403 — and, with it, the empty list a denial would otherwise be indistinguishable
 * from.
 */
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
