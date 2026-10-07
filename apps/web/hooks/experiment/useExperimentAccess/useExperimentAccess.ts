import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import type { QueryUtils } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/** Cache key for an experiment-access response, scoped to the asking principal. */
export function experimentAccessQueryKey(userId: string | undefined, experimentId: string) {
  const input = { id: experimentId };
  return orpc.experiments.getExperimentAccess.queryKey({
    input,
    queryKey: withPrincipal(orpc.experiments.getExperimentAccess.queryKey({ input }), userId),
  });
}

/** The access query, built the same way for the hook and for the server that prefetches it. */
export function experimentAccessQuery(
  utils: QueryUtils,
  userId: string | undefined,
  experimentId: string,
) {
  return utils.experiments.getExperimentAccess.queryOptions({
    input: { id: experimentId },
    queryKey: experimentAccessQueryKey(userId, experimentId),
    retry: shouldRetryQuery,
  });
}

/**
 * Access answers are principal-specific, so the key includes the user and fetching
 * waits for session resolution; otherwise a new user could briefly receive cached
 * capabilities from the previous one. Expose `isPending` as loading because React
 * Query's `isLoading` is false while disabled, which would flash not-found first.
 */
export const useExperimentAccess = (experimentId: string) => {
  const { userId, isPending: isSessionPending } = usePrincipal();

  const query = useQuery({
    ...experimentAccessQuery(orpc, userId, experimentId),
    enabled: !isSessionPending,
  });

  return { ...query, isLoading: query.isPending };
};
