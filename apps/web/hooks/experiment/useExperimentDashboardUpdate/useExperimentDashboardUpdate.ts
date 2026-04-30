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
      // Seed the single-dashboard cache so a quick back-navigation reads
      // the just-saved state, mirroring the visualization-update pattern.
      queryClient.setQueryData(
        ["experiment-dashboard", props.experimentId, data.body.id],
        { body: data.body },
      );
      props.onSuccess?.(data.body);
    },
    onSettled: async () => {
      // List is read on the experiment overview slider; invalidate so card
      // metadata (name, updatedAt) reflects the latest after editing.
      await queryClient.invalidateQueries({
        queryKey: ["experiment-dashboards", props.experimentId],
      });
    },
  });
};
