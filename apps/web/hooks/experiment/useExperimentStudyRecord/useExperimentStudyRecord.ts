import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** The experiment's subjects and related work. */
export const useExperimentStudyRecord = (experimentId: string) => {
  return useQuery(
    orpc.experiments.getStudyRecord.queryOptions({
      input: { id: experimentId },
    }),
  );
};
