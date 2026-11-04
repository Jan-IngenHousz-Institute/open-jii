import { shouldRetryQuery } from "@/util/query-retry";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { orpc } from "~/lib/orpc";

import { DISTINCT_VALUES_MAX_LIMIT } from "@repo/api/domains/experiment/data/experiment-data.schema";

const STALE_TIME = 10 * 60 * 1000;

export interface UseExperimentDistinctValuesArgs {
  experimentId: string;
  tableName: string;
  column: string;
  limit?: number;
  enabled?: boolean;
  allPages?: boolean;
}

export const useExperimentDistinctValues = ({
  experimentId,
  tableName,
  column,
  limit,
  enabled = true,
  allPages = false,
}: UseExperimentDistinctValuesArgs) => {
  const pageLimit = limit ?? (allPages ? DISTINCT_VALUES_MAX_LIMIT : undefined);
  const { data, isLoading, isSuccess, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(
      orpc.experiments.getDistinctColumnValues.infiniteOptions({
        input: (offset: number) => ({
          id: experimentId,
          tableName,
          column,
          limit: pageLimit,
          offset,
        }),
        initialPageParam: 0,
        getNextPageParam: (lastPage, _pages, offset) =>
          allPages && lastPage.truncated && lastPage.values.length > 0
            ? offset + lastPage.values.length
            : undefined,
        staleTime: STALE_TIME,
        enabled: enabled && Boolean(experimentId) && Boolean(tableName) && Boolean(column),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: shouldRetryQuery,
      }),
    );

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !error) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, error, data?.pages.length]);

  return {
    values: data?.pages.flatMap((page) => page.values) ?? [],
    truncated: Boolean(data?.pages.at(-1)?.truncated && (!hasNextPage || error)),
    isLoading: isLoading || Boolean(hasNextPage && !error),
    isSuccess,
    error,
  };
};
