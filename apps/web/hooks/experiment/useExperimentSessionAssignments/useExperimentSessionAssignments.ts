import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentSessionAssignments = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentFieldAssignments.queryOptions({
      input: { id: experimentId },
    }),
  );
};
