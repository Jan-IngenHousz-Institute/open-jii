import React from "react";
import { tsr } from "~/api/tsr";

export function useExperimentFlowQuery(experimentId: string | undefined) {
  const query = tsr.experiments.getFlow.useQuery({
    queryKey: ["experiment-flow", experimentId],
    queryData: { params: { id: experimentId ?? "" } },
    enabled: false,
  });

  const fetchExperimentFlow = React.useCallback(async () => {
    const result = await query.refetch();
    return result.data?.body?.graph?.nodes ?? [];
  }, [query]);

  return {
    fetchExperimentFlow,
    isFetching: query.isFetching,
  };
}
