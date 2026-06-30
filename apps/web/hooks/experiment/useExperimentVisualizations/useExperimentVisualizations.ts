import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/lib/orpc";

import type { ExperimentChartFamily } from "@repo/api/domains/experiment/experiment.schema";

export const useExperimentVisualizations = ({
  experimentId,
  initialChartFamily = undefined,
  initialLimit = 50,
  initialOffset = 0,
}: {
  experimentId: string;
  initialChartFamily?: ExperimentChartFamily | undefined;
  initialLimit?: number;
  initialOffset?: number;
}) => {
  const [chartFamily, setChartFamily] = useState<ExperimentChartFamily | undefined>(
    initialChartFamily,
  );
  const [limit, setLimit] = useState<number>(initialLimit);
  const [offset, setOffset] = useState<number>(initialOffset);

  const { data, isLoading, error } = useQuery(
    orpc.experiments.listExperimentVisualizations.queryOptions({
      input: {
        id: experimentId,
        chartFamily,
        limit,
        offset,
      },
    }),
  );

  // Helper functions for pagination
  const hasNextPage = data?.length === limit;
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
