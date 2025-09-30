import { tsr } from "@/lib/tsr";

import type { ExperimentVisualization } from "@repo/api";

interface ExperimentVisualizationDeleteProps {
  experimentId: string;
  onSuccess?: () => void;
}

export const useExperimentVisualizationDelete = (props: ExperimentVisualizationDeleteProps) => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.deleteExperimentVisualization.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: ["experiment-visualizations", props.experimentId],
      });

      // Get the current visualizations
      const previousVisualizations = queryClient.getQueryData<{
        body: ExperimentVisualization[];
      }>(["experiment-visualizations", props.experimentId]);

      // Return the previous visualizations to use in case of error
      return { previousVisualizations };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousVisualizations) {
        queryClient.setQueryData(
          ["experiment-visualizations", props.experimentId],
          context.previousVisualizations,
        );
      }
    },
    onSettled: async () => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["experiment-visualizations", props.experimentId],
      });
    },
    onSuccess: () => {
      // Call the provided onSuccess callback if it exists
      if (props.onSuccess) {
        props.onSuccess();
      }
    },
  });
};
