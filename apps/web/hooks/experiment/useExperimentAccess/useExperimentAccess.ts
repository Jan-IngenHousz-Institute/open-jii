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
 * Access answers are principal-specific, so the key includes the user and fetching
 * waits for session resolution; otherwise a new user could briefly receive cached
 * capabilities from the previous one. Expose `isPending` as loading because React
 * Query's `isLoading` is false while disabled, which would flash not-found first.
 */
export const useExperimentAccess = (experimentId: string) => {
  const { data: session, isPending: isSessionPending } = useSession();

  const query = useQuery(
    orpc.experiments.getExperimentAccess.queryOptions({
      input: { id: experimentId },
      queryKey: experimentAccessQueryKey(session?.user.id, experimentId),
      retry: shouldRetryQuery,
      enabled: !isSessionPending,
    }),
  );

  return { ...query, isLoading: query.isPending };
};
