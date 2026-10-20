import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

const POLL_MS = 30_000;

export const useExperimentSessionProgress = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getExperimentSessionProgress.queryOptions({
      input: { id: experimentId },
      refetchInterval: POLL_MS,
    }),
  );
};
