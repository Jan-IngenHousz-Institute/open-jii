import { orpc, orpcClient } from "@/lib/orpc";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Records that the caller opened an experiment, once per id while `enabled`. Called
 * on the client rather than through `useMutation`, whose global error toast would
 * show on a page where recording the visit is meant to be invisible.
 */
export function useRecordExperimentVisit(experimentId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    orpcClient.visits
      .recordExperimentVisit({ id: experimentId })
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: orpc.experiments.listRecentlyOpenedExperiments.key(),
        }),
      )
      .catch(() => undefined);
  }, [enabled, experimentId, queryClient]);
}
