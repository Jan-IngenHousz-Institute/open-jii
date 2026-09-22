import { useQuery } from "@tanstack/react-query";
import { isApiStatus } from "~/features/experiments/utils/api-error";
import { orpc } from "~/shared/api/orpc";

export function useResolveJoinCode(code: string | null | undefined) {
  const { data, isLoading, isPaused, error, refetch, isRefetching } = useQuery(
    orpc.experiments.resolveJoinCode.queryOptions({
      input: { code: code ?? "" },
      enabled: !!code,
      // 404 (unknown, expired or revoked), 403 (archived) and 429 (throttled)
      // are all answers. Retrying a 429 would burn the caller's own budget.
      retry: (failureCount, err) => !isApiStatus(err, 404, 403, 429) && failureCount < 3,
      meta: { suppressToast: true },
      networkMode: "offlineFirst",
    }),
  );

  return {
    preview: data,
    isLoading,
    isPaused,
    error,
    refetch,
    isRefetching,
  };
}
