import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** The sessions that ended on one day, given as YYYY-MM-DD. Waits until a day is chosen. */
export const useExperimentSessionsEnded = (experimentId: string, day: string | undefined) => {
  return useQuery(
    orpc.experiments.listExperimentEndedSessions.queryOptions({
      input: { id: experimentId, endedOn: day ?? "" },
      enabled: day !== undefined,
    }),
  );
};
