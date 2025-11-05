import { tsr } from "@/lib/tsr";
import { useState } from "react";

import type { ChartFamily } from "@repo/api";

export const useExperimentVisualizations = ({
  experimentId,
  initialChartFamily = undefined,
  initialLimit = 50,
  initialOffset = 0,
}: {
  experimentId: string;
  initialChartFamily?: ChartFamily | undefined;
  initialLimit?: number;
  initialOffset?: number;
}) => {
  const [chartFamily, setChartFamily] = useState<ChartFamily | undefined>(initialChartFamily);
  const [limit, setLimit] = useState<number>(initialLimit);
  const [offset, setOffset] = useState<number>(initialOffset);

  const { data, isLoading, error } = tsr.experiments.listExperimentVisualizations.useQuery({
    queryData: {
      params: { id: experimentId },
      query: {
        chartFamily,
        limit,
        offset,
      },
    },
    queryKey: ["experiment-visualizations", experimentId, chartFamily, limit, offset],
  });

  // Helper functions for pagination
  const hasNextPage = data?.body && data.body.length === limit;
  const hasPreviousPage = offset > 0;

  const nextPage = () => {
    if (hasNextPage) {
      setOffset(offset + limit);
    }
  };

  const previousPage = () => {
    if (hasPreviousPage) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const resetPagination = () => {
    setOffset(0);
  };

  return {
    data,
    isLoading,
    error,
    // Filter controls
    chartFamily,
    setChartFamily,
    // Pagination controls
    limit,
    setLimit,
    offset,
    setOffset,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    resetPagination,
  };
};
