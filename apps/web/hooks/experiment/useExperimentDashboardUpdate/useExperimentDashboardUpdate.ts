import { tsr } from "@/lib/tsr";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";

interface ExperimentDashboardUpdateProps {
  experimentId: string;
  onSuccess?: (dashboard: ExperimentDashboard) => void;
}

export const useExperimentDashboardUpdate = (props: ExperimentDashboardUpdateProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.updateExperimentDashboard.useMutation({
    onSuccess: (data) => {
      queryClient.setQueryData(["experiment-dashboard", props.experimentId, data.body.id], {
        body: data.body,
      });
      props.onSuccess?.(data.body);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment-dashboards", props.experimentId],
      });
    },
  });
};
