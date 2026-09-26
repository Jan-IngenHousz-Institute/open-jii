import { useQuery } from "@tanstack/react-query";
import { isApiStatus } from "~/features/experiments/utils/api-error";
import { orpc } from "~/shared/api/orpc";

/**
 * 404 (unknown experiment) and 403 (one the caller may not read) are answers.
 * The retry rule and the screen's dead-end branch share this predicate, so a
 * fresh refusal outranks whatever the cache still holds.
 */
function isUnavailableError(error: unknown): boolean {
  return isApiStatus(error, 404, 403);
}

export function useExperimentAccess(id: string | undefined) {
  const { data, isLoading, isPaused, error, refetch, isRefetching } = useQuery(
    orpc.experiments.getExperimentAccess.queryOptions({
      input: { id: id ?? "" },
      enabled: !!id,
      retry: (failureCount, err) => !isUnavailableError(err) && failureCount < 3,
      meta: { suppressToast: true },
      networkMode: "offlineFirst",
      // Both default to false app-wide; without them a join code redeemed or a
      // request approved elsewhere never reaches this screen.
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }),
  );

  return {
    access: data,
    experiment: data?.experiment,
    membershipStatus: data?.membershipStatus,
    isLoading,
    isPaused,
    error,
    // TanStack keeps the last good `data` when a refetch fails, so callers must
    // check this before trusting `experiment`.
    isUnavailable: isUnavailableError(error),
    refetch,
    isRefetching,
  };
}
