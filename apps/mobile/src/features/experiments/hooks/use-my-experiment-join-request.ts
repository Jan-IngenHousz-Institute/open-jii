import { useQuery } from "@tanstack/react-query";
import { isApiStatus } from "~/features/experiments/utils/api-error";
import { orpc } from "~/shared/api/orpc";

interface UseMyExperimentJoinRequestArgs {
  enabled?: boolean;
}

/**
 * The caller's own pending join request. It exists only to learn the `requestId`
 * that cancelling needs, so it stays disabled until the access read says the
 * caller is actually waiting on a decision.
 */
export function useMyExperimentJoinRequest(
  id: string | undefined,
  { enabled = true }: UseMyExperimentJoinRequestArgs = {},
) {
  const { data, isLoading, error, refetch } = useQuery(
    orpc.experiments.getMyJoinRequest.queryOptions({
      input: { id: id ?? "" },
      enabled: !!id && enabled,
      retry: (failureCount, err) => !isApiStatus(err, 404) && failureCount < 3,
      meta: { suppressToast: true },
      networkMode: "offlineFirst",
    }),
  );

  // 404 is "you have no request here" — the answer the screen needs when a
  // decision landed elsewhere, not a failure to report.
  const isNone = isApiStatus(error, 404);

  return {
    joinRequest: data,
    requestId: data?.id,
    isLoading,
    error: isNone ? undefined : error,
    isNone,
    refetch,
  };
}
