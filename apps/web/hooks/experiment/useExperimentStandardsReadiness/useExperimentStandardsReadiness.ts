import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentStandardsReadiness = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentStandardsReadiness.queryOptions({
      input: { id: experimentId },
    }),
  );
};
