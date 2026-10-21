import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** What the experiment follows, where each standard stands, and the steps for every standard. */
export const useExperimentStandards = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentStandards.queryOptions({
      input: { id: experimentId },
    }),
  );
};
