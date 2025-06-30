import { tsr } from "~/lib/tsr";

import type { ExperimentDataQuery } from "@repo/api";

/**
 * Hook to fetch experiment data by ID using regular pagination
 * @param experimentId The ID of the experiment to fetch
 * @param queryData Query data
 * @param staleTime Time in ms before data is removed from the cache
 * @returns Query result containing the experiment data
 */
export const useExperimentData = (
  experimentId: string,
  queryData?: ExperimentDataQuery,
  staleTime?: number,
) => {
  return tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { ...queryData },
    },
    queryKey: [
      "experiment",
      experimentId,
      queryData?.page,
      queryData?.pageSize,
      queryData?.tableName,
    ],
    staleTime,
  });
};

/**
 * Hook to fetch experiment data by ID using infinite pagination
 * @param experimentId The ID of the experiment to fetch
 * @param queryData Base query data (without page parameter)
 * @param staleTime Time in ms before data is removed from the cache
 * @returns Infinite query result containing the experiment data
 */
export const useExperimentDataInfinite = (
  experimentId: string,
  queryData?: Omit<ExperimentDataQuery, "page">,
  staleTime?: number,
) => {
  return tsr.experiments.getExperimentData.useInfiniteQuery({
    queryData: ({ pageParam }) => ({
      params: { id: experimentId },
      query: { ...queryData, page: pageParam },
    }),
    queryKey: ["experiment-infinite", experimentId, queryData?.pageSize, queryData?.tableName],
    staleTime,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const tableData = lastPage.body[0];
      if (!tableData.data) return undefined;

      const currentPage = tableData.page;
      const hasMore = currentPage < tableData.totalPages;
      return hasMore ? currentPage + 1 : undefined;
    },
    getPreviousPageParam: (firstPage) => {
      const tableData = firstPage.body[0];
      if (!tableData.data) return undefined;

      const currentPage = tableData.page;
      return currentPage > 1 ? currentPage - 1 : undefined;
    },
  });
};
