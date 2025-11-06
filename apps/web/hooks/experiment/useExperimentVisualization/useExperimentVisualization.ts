import { tsr } from "@/lib/tsr";

export const useExperimentVisualization = (visualizationId: string, experimentId: string) => {
  return tsr.experiments.getExperimentVisualization.useQuery({
    queryData: {
      params: { id: experimentId, visualizationId },
    },
    queryKey: ["experiment-visualization", experimentId, visualizationId],
  });
};
