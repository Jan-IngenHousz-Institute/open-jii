import { tsr } from "@/lib/tsr";
import { useCallback, useMemo, useState } from "react";

// Contract max is 100; the +1 probe needs room within it.
const MAX_BACKEND_LIMIT = 100;
const MAX_USER_LIMIT = MAX_BACKEND_LIMIT - 1;

const clampLimit = (n: number) => Math.max(1, Math.min(n, MAX_USER_LIMIT));

export const useExperimentDashboards = ({
  experimentId,
  initialLimit = 50,
  initialOffset = 0,
}: {
  experimentId: string;
  initialLimit?: number;
  initialOffset?: number;
}) => {
  const [limit, setLimitState] = useState<number>(() => clampLimit(initialLimit));
  const [offset, setOffset] = useState<number>(initialOffset);
  const setLimit = useCallback((n: number) => setLimitState(clampLimit(n)), []);

  // Probe one extra row to detect a real next page vs. an exactly-full one.
  const requestedLimit = limit + 1;

  const {
    data: rawData,
    isLoading,
    error,
  } = tsr.experiments.listExperimentDashboards.useQuery({
    queryData: {
      params: { id: experimentId },
      query: { limit: requestedLimit, offset },
    },
    queryKey: ["experiment-dashboards", experimentId, requestedLimit, offset],
  });

  const data = useMemo(
    () => (rawData ? { ...rawData, body: rawData.body.slice(0, limit) } : rawData),
    [rawData, limit],
  );

  const hasNextPage = (rawData?.body.length ?? 0) > limit;
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
