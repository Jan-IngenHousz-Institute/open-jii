import { withPrincipal } from "@/hooks/principal-query-key";
import { getOrpcError, orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/** Cache key for the current user's pending request, scoped to that user. */
export function myJoinRequestQueryKey(userId: string | undefined, experimentId: string) {
  const input = { id: experimentId };
  return orpc.experiments.getMyJoinRequest.queryKey({
    input,
    queryKey: withPrincipal(orpc.experiments.getMyJoinRequest.queryKey({ input }), userId),
  });
}

/**
 * Hook that returns the signed-in user's pending join request for an experiment.
 * The API throws a 404 when there is no pending request: that is the normal
 * "you can request to join" state, so the 404 is not retried and the query's
 * `error` is treated as "no request" by consumers rather than surfaced.
 */
export const useMyJoinRequest = (experimentId: string, enabled = true) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const query = useQuery(
    orpc.experiments.getMyJoinRequest.queryOptions({
      input: { id: experimentId },
      queryKey: myJoinRequestQueryKey(session?.user.id, experimentId),
      enabled: !!experimentId && enabled && !isSessionPending,
      retry(failureCount, error) {
        if (getOrpcError(error)?.status === 404) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    }),
  );

  // A disabled query is pending but not "loading" in React Query. Expose the
  // pending state so consumers do not flash a no-request action while auth resolves.
  return { ...query, isLoading: query.isPending };
};
