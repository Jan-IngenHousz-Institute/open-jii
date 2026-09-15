import { useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";

/** The server answers 404, never 403, for an organization the caller may not see. */
function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}

export function useOrganization(id: string | undefined) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery(
    orpc.organizations.getOrganization.queryOptions({
      input: { id: id ?? "" },
      enabled: !!id,
      retry: (failureCount, err) => !isNotFoundError(err) && failureCount < 3,
      meta: { suppressToast: true },
      networkMode: "offlineFirst",
      // Both default to false app-wide; without them an approval granted on web
      // never reaches this screen.
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }),
  );

  return {
    organization: data,
    isLoading,
    error,
    // TanStack keeps the last good `data` when a refetch fails, so callers must
    // check this before trusting `organization`.
    isNotFound: isNotFoundError(error),
    refetch,
    isRefetching,
  };
}
