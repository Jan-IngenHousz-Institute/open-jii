import { tsr } from "~/lib/tsr";

import type { ExperimentDataQuery } from "@repo/api";

/**
 * Hook to fetch experiment data by ID
 * @param experimentId The ID of the experiment to fetch
 * @param queryData Query data
 * @returns Query result containing the experiment data
 */
export const useExperimentData = (experimentId: string, queryData?: ExperimentDataQuery) => {
  return tsr.experiments.getExperimentData.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { ...queryData },
    },
    queryKey: ["experiment", experimentId, "page", queryData?.page],
  });
};
