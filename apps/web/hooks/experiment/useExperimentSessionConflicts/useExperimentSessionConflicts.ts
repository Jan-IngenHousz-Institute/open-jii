import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentSessionConflicts = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentPlotConflicts.queryOptions({
      input: { id: experimentId },
    }),
  );
};
