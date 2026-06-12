import { tsr } from "@/shared/api/tsr";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";

interface ExperimentVisualizationUpdateProps {
  experimentId: string;
  onSuccess?: (visualization: ExperimentVisualization) => void;
}

export const useExperimentVisualizationUpdate = (props: ExperimentVisualizationUpdateProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.updateExperimentVisualization.useMutation({
    onSuccess: (data) => {
      // Seed the single-viz cache with the server response so a quick
      // back-and-forth navigation reads the just-saved state instead of the
      // stale snapshot from the layout's initial load. The autosave path
      // also rebases the form's defaults; this keeps both in sync.
      queryClient.setQueryData(["experiment-visualization", props.experimentId, data.body.id], {
        body: data.body,
      });
      props.onSuccess?.(data.body);
    },
    onSettled: async () => {
      // The list query feeds the experiment overview page; invalidate so
      // navigating away reflects the latest names/types.
      await queryClient.invalidateQueries({
        queryKey: ["experiment-visualizations", props.experimentId],
      });
    },
  });
};
