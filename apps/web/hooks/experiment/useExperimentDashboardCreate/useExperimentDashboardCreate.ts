import { tsr } from "@/lib/tsr";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentDashboardCreateProps {
  experimentId: string;
  onSuccess?: (dashboard: ExperimentDashboard) => void;
}

export const useExperimentDashboardCreate = (props: ExperimentDashboardCreateProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.createExperimentDashboard.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment-dashboards", props.experimentId],
      });
    },
    onSuccess: (data) => {
      props.onSuccess?.(data.body);
    },
  });
};
