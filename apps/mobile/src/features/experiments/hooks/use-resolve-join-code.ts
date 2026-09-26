import { useQuery } from "@tanstack/react-query";
import { isApiStatus } from "~/features/experiments/utils/api-error";
import { orpc } from "~/shared/api/orpc";

export function useResolveJoinCode(code: string | null | undefined) {
  const { data, isLoading, isPaused, error, errorUpdatedAt, refetch, isRefetching } = useQuery(
    orpc.experiments.resolveJoinCode.queryOptions({
      input: { code: code ?? "" },
      enabled: !!code,
      // 404 (unknown, expired or revoked), 403 (archived) and 429 (throttled)
      // are all answers. Retrying a 429 would burn the caller's own budget.
      retry: (failureCount, err) => !isApiStatus(err, 404, 403, 429) && failureCount < 3,
      meta: { suppressToast: true },
      networkMode: "offlineFirst",
      // Both default to false app-wide, and the preview is cached forever. A
      // membership or the code itself can change between visits, so without
      // these a second look at the same code answers from the first one.
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }),
  );

  return {
    preview: data,
    isLoading,
    isPaused,
    error,
    errorUpdatedAt,
    refetch,
    isRefetching,
  };
}
