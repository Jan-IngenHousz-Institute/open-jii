import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { orpc } from "~/shared/api/orpc";

import { isPaginatedList } from "@repo/api/shared/listing";

const PAGE_SIZE = 20;

// The persisted cache admits only the unpaged `related` input, so these pages
// live in memory alone; five minutes keeps a back-navigation instant without
// holding every search the student ever ran.
const GC_TIME_MS = 5 * 60 * 1000;

interface UseDiscoverExperimentsArgs {
  search?: string;
  enabled?: boolean;
}

export function useDiscoverExperiments({
  search,
  enabled = true,
}: UseDiscoverExperimentsArgs = {}) {
  const trimmed = search?.trim() ?? "";

  const {
    data,
    isLoading,
    isFetching,
    isPaused,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
  } = useInfiniteQuery(
    orpc.experiments.listExperiments.infiniteOptions({
      // An empty search must be `undefined`, not `""`: the two mean the same
      // thing but are different cache keys.
      input: (page: number) => ({
        scope: "all" as const,
        search: trimmed.length > 0 ? trimmed : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        isPaginatedList(lastPage) && lastPage.page < lastPage.totalPages
          ? lastPage.page + 1
          : undefined,
      enabled,
      // The section renders its own inline failure; a toast would double it.
      meta: { suppressToast: true },
      networkMode: "offlineFirst",
      // Both default to false app-wide.
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      placeholderData: keepPreviousData,
      gcTime: GC_TIME_MS,
    }),
  );

  // `undefined` until a response arrives, which is not `[]`: a cold offline
  // start pauses with no data, no error and `isLoading: false`.
  const experiments = data?.pages.flatMap((page) => (isPaginatedList(page) ? page.items : page));
  const lastPage = data?.pages.at(-1);

  return {
    experiments,
    totalCount:
      lastPage !== undefined && isPaginatedList(lastPage)
        ? lastPage.totalCount
        : experiments?.length,
    isLoading,
    isFetching,
    isPaused,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    isFetchingNextPage,
    hasNextPage,
  };
}
