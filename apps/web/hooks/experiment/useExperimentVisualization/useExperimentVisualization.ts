import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export const useExperimentVisualization = (visualizationId: string, experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentVisualization.queryOptions({
      input: { id: experimentId, visualizationId },
    }),
  );
};
