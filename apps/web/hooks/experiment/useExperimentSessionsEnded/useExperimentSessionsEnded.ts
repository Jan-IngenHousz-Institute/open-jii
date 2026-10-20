import { orpc } from "@/lib/orpc";
import { formatYmd } from "@/util/date";
import { useQuery } from "@tanstack/react-query";

export const useExperimentSessionsEnded = (experimentId: string, day: Date) => {
  return useQuery(
    orpc.experiments.listExperimentEndedSessions.queryOptions({
      input: { id: experimentId, endedOn: formatYmd(day) },
    }),
  );
};
