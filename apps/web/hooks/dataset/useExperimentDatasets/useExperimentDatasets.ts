import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentDatasets = (experimentId: string) => {
  return useQuery(
    orpc.datasets.listExperimentDatasets.queryOptions({
      input: { id: experimentId },
    }),
  );
};
