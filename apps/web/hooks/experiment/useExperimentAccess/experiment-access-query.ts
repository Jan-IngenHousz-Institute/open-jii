import { withPrincipal } from "@/hooks/principal-query-key";
import { getOrpcError, orpc } from "@/lib/orpc";
import type { QueryUtils } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";

export function isExperimentReadDenied(error: unknown) {
  const status = getOrpcError(error)?.status;
  return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

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
