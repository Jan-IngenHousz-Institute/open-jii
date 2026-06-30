import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentDashboardCreateProps {
  experimentId: string;
  onSuccess?: (dashboard: ExperimentDashboard) => void;
}

export const useExperimentDashboardCreate = (props: ExperimentDashboardCreateProps) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.createExperimentDashboard.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentDashboards.key({
            input: { id: props.experimentId },
          }),
        });
      },
      onSuccess: (data) => {
        props.onSuccess?.(data);
      },
    }),
  );
};
