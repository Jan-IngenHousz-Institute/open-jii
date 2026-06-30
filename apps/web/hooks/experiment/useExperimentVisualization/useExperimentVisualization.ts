import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentVisualization = (visualizationId: string, experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentVisualization.queryOptions({
      input: { id: experimentId, visualizationId },
    }),
  );
};
