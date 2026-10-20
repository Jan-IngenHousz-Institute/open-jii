import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentLayoutPlot = (experimentId: string, plotId: string) => {
  return useQuery(
    orpc.experiments.getExperimentLayoutPlot.queryOptions({
      input: { id: experimentId, plotId },
    }),
  );
};
