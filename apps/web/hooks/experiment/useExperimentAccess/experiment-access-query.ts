import { withPrincipal } from "@/hooks/principal-query-key";
import { getOrpcError, orpc } from "@/lib/orpc";
import type { QueryUtils } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { hashKey } from "@tanstack/react-query";
import type { QueryClient, QueryFunctionContext, QueryKey } from "@tanstack/react-query";

const confirmedReadDenials = new WeakMap<QueryClient, Set<string>>();

export function isExperimentReadDenied(error: unknown) {
  const status = getOrpcError(error)?.status;
  return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export function hasConfirmedExperimentReadDenial(client: QueryClient, queryKey: QueryKey) {
  return confirmedReadDenials.get(client)?.has(hashKey(queryKey)) ?? false;
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
  const options = utils.experiments.getExperimentAccess.queryOptions({
    input: { id: experimentId },
    queryKey: experimentAccessQueryKey(userId, experimentId),
    retry: shouldRetryQuery,
  });
  const key = hashKey(options.queryKey);
  return {
    ...options,
    async queryFn(context: QueryFunctionContext) {
      const { client, signal } = context;
      try {
        const access = await options.queryFn(context);
        if (!signal.aborted) {
          confirmedReadDenials.get(client)?.delete(key);
        }
        return access;
      } catch (error) {
        // A later transient error replaces the query error while leaving its old data intact.
        if (!signal.aborted && isExperimentReadDenied(error)) {
          let denied = confirmedReadDenials.get(client);
          if (!denied) {
            denied = new Set();
            confirmedReadDenials.set(client, denied);
          }
          denied.add(key);
        }
        throw error;
      }
    },
  };
}
