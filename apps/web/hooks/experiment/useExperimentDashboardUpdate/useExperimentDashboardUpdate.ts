import { usePrincipal } from "@/components/auth/principal-context";
import { getOrpcError, orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { experimentAccessQueryKey } from "../useExperimentAccess/experiment-access-query";

interface ExperimentDashboardUpdateProps {
  experimentId: string;
  onSuccess?: (dashboard: ExperimentDashboard) => void;
}

export const useExperimentDashboardUpdate = (props: ExperimentDashboardUpdateProps) => {
  const queryClient = useQueryClient();
  const { userId } = usePrincipal();

  return useMutation(
    orpc.experiments.updateExperimentDashboard.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(
          orpc.experiments.getExperimentDashboard.queryKey({
            input: { id: props.experimentId, dashboardId: data.id },
          }),
          data,
        );
        props.onSuccess?.(data);
      },
      onError: async (error) => {
        if (getOrpcError(error)?.status !== 403) return;
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
