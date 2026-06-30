import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

interface ExperimentVisualizationDeleteProps {
  experimentId: string;
  onSuccess?: () => void;
}

export const useExperimentVisualizationDelete = (props: ExperimentVisualizationDeleteProps) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.deleteExperimentVisualization.mutationOptions({
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
      onSuccess: () => {
        props.onSuccess?.();
      },
    }),
  );
};
