import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/** Cache key for an experiment-access response, scoped to the asking principal. */
export function experimentAccessQueryKey(userId: string | undefined, experimentId: string) {
  const input = { id: experimentId };
  return orpc.experiments.getExperimentAccess.queryKey({
    input,
    queryKey: withPrincipal(orpc.experiments.getExperimentAccess.queryKey({ input }), userId),
  });
}

/**
 * Experiment details plus the caller's own access to it.
 *
 * The response is per-principal, not per-experiment: `hasAccess`, `isAdmin` and
 * `capabilities` are the server's answer for whoever asked, and pages gate real
 * controls — and share-gated follow-up requests — on them. So the cache entry
 * carries the principal, and nothing is fetched until the session resolves;
 * otherwise a second user on the same browser could read the first user's
 * capabilities as a settled `success` while their own request is still in flight
 * (see `principal-query-key`).
 *
 * @param experimentId The ID of the experiment to fetch
 * @returns Query result containing the experiment details and access info
 */
export const useExperimentAccess = (experimentId: string) => {
  const { data: session, isPending: isSessionPending } = useSession();

  return useQuery(
    orpc.experiments.getExperimentAccess.queryOptions({
      input: { id: experimentId },
      queryKey: experimentAccessQueryKey(session?.user.id, experimentId),
      retry: shouldRetryQuery,
      enabled: !isSessionPending,
    }),
  );
};
