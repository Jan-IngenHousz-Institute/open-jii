import { tsr } from "@/lib/tsr";
import { useState } from "react";

export const useExperimentDashboards = ({
  experimentId,
  initialLimit = 50,
  initialOffset = 0,
}: {
  experimentId: string;
  initialLimit?: number;
  initialOffset?: number;
}) => {
  const [limit, setLimit] = useState<number>(initialLimit);
  const [offset, setOffset] = useState<number>(initialOffset);

  const { data, isLoading, error } = tsr.experiments.listExperimentDashboards.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { limit, offset },
    },
    queryKey: ["experiment-dashboards", experimentId, limit, offset],
  });

  const hasNextPage = data?.body.length === limit;
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

  const resetPagination = () => setOffset(0);

  return {
    data,
    isLoading,
    error,
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
