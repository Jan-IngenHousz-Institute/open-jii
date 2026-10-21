import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentLayoutAttributes = (experimentId: string, enabled: boolean) => {
  return useQuery({
    ...orpc.experiments.getExperimentLayoutAttributes.queryOptions({
      input: { id: experimentId },
    }),
    enabled,
  });
};
