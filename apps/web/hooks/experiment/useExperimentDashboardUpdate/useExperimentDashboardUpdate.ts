import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentDashboardUpdateProps {
  experimentId: string;
  onSuccess?: (dashboard: ExperimentDashboard) => void;
}

export const useExperimentDashboardUpdate = (props: ExperimentDashboardUpdateProps) => {
  const queryClient = useQueryClient();

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
