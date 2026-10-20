import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export const useExperimentPublications = (experimentId: string) => {
  return useQuery(
    orpc.datasets.listExperimentPublications.queryOptions({
      input: { id: experimentId },
    }),
  );
};
