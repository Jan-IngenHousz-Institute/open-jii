import { useQuery } from "@tanstack/react-query";

import { getOrpcError, orpc } from "@/lib/orpc";

/**
 * Hook that returns the signed-in user's pending join request for an experiment.
 * The API throws a 404 when there is no pending request: that is the normal
 * "you can request to join" state, so the 404 is not retried and the query's
 * `error` is treated as "no request" by consumers rather than surfaced.
 */
export const useMyJoinRequest = (experimentId: string, enabled = true) => {
  return useQuery(
    orpc.experiments.getMyJoinRequest.queryOptions({
      input: { id: experimentId },
      enabled: !!experimentId && enabled,
      retry(failureCount, error) {
        if (getOrpcError(error)?.status === 404) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    }),
  );
};
