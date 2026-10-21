import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentMeasuredTwice = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentMeasuredTwice.queryOptions({
      input: { id: experimentId },
    }),
  );
};
