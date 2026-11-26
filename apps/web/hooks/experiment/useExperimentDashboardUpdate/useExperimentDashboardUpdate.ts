import { usePrincipalSession } from "@/components/auth/principal-context";
import { isCurrentSession } from "@/hooks/auth/is-current-session";
import { getOrpcError, orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { experimentAccessQueryKey } from "../useExperimentAccess/experiment-access-query";
import { experimentDashboardQuery } from "../useExperimentDashboard/useExperimentDashboard";

interface ExperimentDashboardUpdateProps {
  experimentId: string;
  onSuccess?: (dashboard: ExperimentDashboard) => void;
}

export const useExperimentDashboardUpdate = (props: ExperimentDashboardUpdateProps) => {
  const queryClient = useQueryClient();
  const { userId, sessionId } = usePrincipalSession();

  return useMutation(
    orpc.experiments.updateExperimentDashboard.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(
          experimentDashboardQuery(data.id, props.experimentId, userId).queryKey,
          data,
        );
        props.onSuccess?.(data);
      },
      onError: async (error) => {
        if (getOrpcError(error)?.status !== 403 || !(await isCurrentSession(sessionId))) return;
        await queryClient.invalidateQueries({
          queryKey: experimentAccessQueryKey(userId, props.experimentId),
          exact: true,
        });
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentDashboards.key({
            input: { id: props.experimentId },
          }),
        });
      },
    }),
  );
};
