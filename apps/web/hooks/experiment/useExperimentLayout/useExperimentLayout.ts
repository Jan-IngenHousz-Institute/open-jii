import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentLayout = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentLayout.queryOptions({
      input: { id: experimentId },
    }),
  );
};
