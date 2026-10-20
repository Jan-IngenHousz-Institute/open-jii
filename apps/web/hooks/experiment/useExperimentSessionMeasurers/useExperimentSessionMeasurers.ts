import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentSessionMeasurers = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentMeasurers.queryOptions({
      input: { id: experimentId },
    }),
  );
};
