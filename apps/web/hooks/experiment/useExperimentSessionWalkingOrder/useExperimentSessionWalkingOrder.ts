import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentSessionWalkingOrder = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentWalkingOrder.queryOptions({
      input: { id: experimentId },
    }),
  );
};
