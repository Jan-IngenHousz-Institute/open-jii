import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Fetches the experiment's public-facing contributor credits. */
export const useExperimentContributors = (experimentId: string) => {
  return useQuery(
    orpc.experiments.listExperimentContributors.queryOptions({
      input: { id: experimentId },
    }),
  );
};
