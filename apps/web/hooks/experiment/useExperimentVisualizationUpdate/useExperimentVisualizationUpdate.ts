import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentVisualizationUpdateProps {
  experimentId: string;
  onSuccess?: (visualization: ExperimentVisualization) => void;
}

export const useExperimentVisualizationUpdate = (props: ExperimentVisualizationUpdateProps) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.updateExperimentVisualization.mutationOptions({
      onSuccess: (data) => {
        // Seed the single-viz cache with the server response so a quick
        // back-and-forth navigation reads the just-saved state instead of the
        // stale snapshot from the layout's initial load. The autosave path
        // also rebases the form's defaults; this keeps both in sync.
        queryClient.setQueryData(
          orpc.experiments.getExperimentVisualization.queryKey({
            input: { id: props.experimentId, visualizationId: data.id },
          }),
          data,
        );
        props.onSuccess?.(data);
      },
      onSettled: async () => {
        // The list query feeds the experiment overview page; invalidate so
        // navigating away reflects the latest names/types.
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentVisualizations.key({
            input: { id: props.experimentId },
          }),
        });
      },
    }),
  );
};
