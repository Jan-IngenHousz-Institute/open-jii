import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentVisualizationCreateProps {
  experimentId: string;
  onSuccess?: (visualization: ExperimentVisualization) => void;
}

export const useExperimentVisualizationCreate = (props: ExperimentVisualizationCreateProps) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.createExperimentVisualization.mutationOptions({
      onMutate: async () => {
        // Cancel any outgoing refetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries({
          queryKey: orpc.experiments.listExperimentVisualizations.key({
            input: { id: props.experimentId },
          }),
        });
      },
      onSettled: async () => {
        // Always refetch after error or success to make sure cache is in sync with server
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentVisualizations.key({
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
