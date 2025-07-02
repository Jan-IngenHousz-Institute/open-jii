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
