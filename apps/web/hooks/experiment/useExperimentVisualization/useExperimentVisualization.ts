import { orpc } from "@/lib/orpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { experimentVisualizationIndexOptions } from "../useExperimentVisualizationIndex/useExperimentVisualizationIndex";

const STALE_TIME = 2 * 60 * 1000;

export const useExperimentVisualization = (visualizationId: string, experimentId: string) => {
  const queryClient = useQueryClient();
  const indexKey = experimentVisualizationIndexOptions(experimentId).queryKey;

  return useQuery(
    orpc.experiments.getExperimentVisualization.queryOptions({
      input: { id: experimentId, visualizationId },
      // A dashboard has already listed the experiment's visualizations; start
      // from that row and let it age with the list instead of fetching again.
      initialData: () =>
        queryClient.getQueryData(indexKey)?.find((item) => item.id === visualizationId),
      initialDataUpdatedAt: () => queryClient.getQueryState(indexKey)?.dataUpdatedAt,
      staleTime: STALE_TIME,
    }),
  );
};
