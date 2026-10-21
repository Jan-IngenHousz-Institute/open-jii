import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentSessionDays = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentSessionDays.queryOptions({
      input: { id: experimentId },
    }),
  );
};
