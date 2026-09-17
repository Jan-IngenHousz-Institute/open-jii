import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";

interface UseOrganizationDirectoryArgs {
  search?: string;
  scope?: "related" | "all";
  enabled?: boolean;
}

export function useOrganizationDirectory({
  search,
  scope = "all",
  enabled = true,
}: UseOrganizationDirectoryArgs = {}) {
  const trimmed = search?.trim() ?? "";

  const { data, isLoading, isFetching, isPaused, error, refetch, isRefetching } = useQuery(
    orpc.organizations.listOrganizations.queryOptions({
      // An empty search must be `undefined`, not `""`: the two mean the same
      // thing but are different cache keys, and Home shares the unfiltered one.
      input: { search: trimmed.length > 0 ? trimmed : undefined, scope },
      enabled,
      // Callers render their own inline failure; a toast would double it, and on
      // Home it would shout about a card the user cannot see.
      meta: { suppressToast: true },
      networkMode: "offlineFirst",
      // Both default to false app-wide.
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      placeholderData: keepPreviousData,
    }),
  );

  return {
    // `undefined` until a response arrives, which is not `[]`: a cold offline
    // start pauses with no data, no error and `isLoading: false`.
    organizations: data?.organizations,
    isLoading,
    isFetching,
    // Paused means offlineFirst gave up before reaching the network: no data and
    // no error either, so it is not a failure to report as one.
    isPaused,
    error,
    refetch,
    isRefetching,
  };
}
