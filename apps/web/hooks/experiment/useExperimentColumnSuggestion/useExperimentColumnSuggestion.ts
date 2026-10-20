import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** The description other experiments accepted for the same column, if any did. */
export const useExperimentColumnSuggestion = (
  experimentId: string,
  column: string,
  enabled: boolean,
) => {
  return useQuery(
    orpc.experiments.getColumnSuggestion.queryOptions({
      input: { id: experimentId, column },
      enabled,
    }),
  );
};
