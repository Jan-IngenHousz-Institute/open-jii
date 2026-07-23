import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to delete an experiment
 * @returns Mutation object for deleting experiments
 */
export const useExperimentDelete = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.deleteExperiment.mutationOptions({
      onMutate: async (variables) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: orpc.experiments.listExperiments.key() });

        // Remove the single experiment from cache as well
        queryClient.removeQueries({
          queryKey: orpc.experiments.getExperiment.queryKey({ input: { id: variables.id } }),
        });
      },
      onSettled: async () => {
        // Always invalidate to ensure cache is in sync with server
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperiments.key(),
        });
      },
    }),
  );
};
