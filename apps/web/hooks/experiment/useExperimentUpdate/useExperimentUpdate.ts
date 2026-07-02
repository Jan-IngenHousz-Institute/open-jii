import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";

/**
 * Hook to update an existing experiment
 * @returns Mutation object for updating experiments
 */
export const useExperimentUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.updateExperiment.mutationOptions({
      onMutate: async (variables) => {
        const experimentKey = orpc.experiments.getExperiment.queryKey({
          input: { id: variables.id },
        });

        // Cancel any outgoing refetches to avoid overwrites
        await queryClient.cancelQueries({ queryKey: experimentKey });
        await queryClient.cancelQueries({ queryKey: orpc.experiments.listExperiments.key() });

        // Get the current experiment data
        const previousExperiment = queryClient.getQueryData<Experiment>(experimentKey);

        // Optimistically update the cache. `locations` carries a different
        // (input) shape than the cached experiment, so it's excluded here and
        // refreshed on settle.
        if (previousExperiment) {
          const { locations: _locations, ...scalarChanges } = variables;
          queryClient.setQueryData<Experiment>(experimentKey, (current) =>
            current ? { ...current, ...scalarChanges } : current,
          );
        }

        return { previousExperiment };
      },
      onError: (_error, variables, context) => {
        // Revert updates on error
        if (context?.previousExperiment) {
          queryClient.setQueryData(
            orpc.experiments.getExperiment.queryKey({ input: { id: variables.id } }),
            context.previousExperiment,
          );
        }
      },
      onSettled: async (_data, _error, variables) => {
        // Always refetch after error or success
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperiment.queryKey({ input: { id: variables.id } }),
          exact: true,
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getExperimentAccess.queryKey({ input: { id: variables.id } }),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperiments.key(),
        });
      },
    }),
  );
};
